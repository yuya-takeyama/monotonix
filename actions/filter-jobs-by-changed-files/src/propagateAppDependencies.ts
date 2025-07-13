import { Jobs } from '@monotonix/schema';

/**
 * ファイル変更から影響を受けるアプリを特定
 */
export const getAffectedAppsFromChangedFiles = (
  changedFiles: string[],
  jobs: Jobs,
): string[] => {
  // app_pathからアプリ名へのマッピングを作成（パス長順でソート、長い方が優先）
  const appPathEntries = Array.from(
    new Map(jobs.map(job => [job.context.app_path, job.app.name])).entries()
  ).sort(([a], [b]) => b.length - a.length);

  // 変更ファイルから影響を受けるアプリを特定（最長一致）
  const affectedApps = new Set<string>();
  for (const file of changedFiles) {
    for (const [appPath, appName] of appPathEntries) {
      if (file.startsWith(appPath + '/') || file === appPath) {
        affectedApps.add(appName);
        break; // 最初にマッチしたもの（最も長いパス）を使用
      }
    }
  }

  return Array.from(affectedApps);
};

/**
 * アプリベースの依存関係伝播
 */
export const propagateAppDependencies = (
  affectedApps: string[],
  jobs: Jobs,
): string[] => {
  // アプリ名から依存関係マップを作成
  const appDependencies = new Map<string, string[]>();
  for (const job of jobs) {
    const depends = job.app.depends_on || [];
    if (depends.length > 0) {
      appDependencies.set(job.app.name, depends);
    }
  }

  // 推移的に依存関係を解決
  const allAffectedApps = new Set(affectedApps);
  let changed = true;

  while (changed) {
    changed = false;
    for (const [appName, dependencies] of appDependencies.entries()) {
      const hasDependencyChanges = dependencies.some(dep =>
        allAffectedApps.has(dep),
      );
      if (hasDependencyChanges && !allAffectedApps.has(appName)) {
        allAffectedApps.add(appName);
        changed = true;
      }
    }
  }

  return Array.from(allAffectedApps);
};

/**
 * ファイル変更からアプリ依存関係を考慮したジョブフィルタリング
 */
export const filterJobsByAppDependencies = (
  changedFiles: string[],
  jobs: Jobs,
): Jobs => {
  console.log('🔍 [DEBUG] filterJobsByAppDependencies starting');
  console.log('🔍 [DEBUG] changedFiles:', changedFiles);
  console.log('🔍 [DEBUG] available jobs:', jobs.map(j => ({ 
    name: j.app.name, 
    path: j.context.app_path, 
    depends_on: j.app.depends_on,
    job_key: j.context.job_key
  })));

  // 1. ファイル変更からアプリを特定
  const directlyAffectedApps = getAffectedAppsFromChangedFiles(
    changedFiles,
    jobs,
  );
  console.log('🔍 [DEBUG] directlyAffectedApps:', directlyAffectedApps);

  // 2. 依存関係を考慮してアプリリストを拡張
  const allAffectedApps = propagateAppDependencies(directlyAffectedApps, jobs);
  console.log('🔍 [DEBUG] allAffectedApps after propagation:', allAffectedApps);

  // 3. 影響を受けるアプリのジョブのみフィルタ
  const filteredJobs = jobs.filter(job => allAffectedApps.includes(job.app.name));
  console.log('🔍 [DEBUG] filteredJobs:', filteredJobs.map(j => ({ 
    name: j.app.name, 
    job_key: j.context.job_key 
  })));

  return filteredJobs;
};