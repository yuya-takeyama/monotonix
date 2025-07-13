import { Jobs } from '@monotonix/schema';
import { getOctokit, context } from '@actions/github';

/**
 * ファイル変更に基づいてジョブをフィルタリング
 * 依存関係の考慮は load-jobs の effective timestamp で行われる
 */
const filterJobsByChangedFiles = (changedFiles: string[], jobs: Jobs): Jobs => {
  console.log('🔍 [DEBUG] filterJobsByChangedFiles starting');
  console.log('🔍 [DEBUG] changedFiles:', changedFiles);
  console.log('🔍 [DEBUG] available jobs:', jobs.map(j => ({ 
    name: j.app.name, 
    path: j.context.app_path, 
    job_key: j.context.job_key
  })));

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

  console.log('🔍 [DEBUG] affectedApps:', Array.from(affectedApps));

  // 影響を受けるアプリのジョブのみフィルタ
  const filteredJobs = jobs.filter(job => affectedApps.has(job.app.name));
  console.log('🔍 [DEBUG] filteredJobs:', filteredJobs.map(j => ({ 
    name: j.app.name, 
    job_key: j.context.job_key 
  })));

  return filteredJobs;
};

type runParams = {
  githubToken: string;
  jobs: Jobs;
};
export const run = async ({ githubToken, jobs }: runParams): Promise<Jobs> => {
  const octokit = getOctokit(githubToken);

  switch (context.eventName) {
    case 'pull_request':
    case 'pull_request_target':
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.issue.number,
      });

      const prChangedFiles = files.map(file => file.filename);
      return filterJobsByChangedFiles(prChangedFiles, jobs);

    default:
      const { data: commits } = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
      });

      const pushChangedFiles = (commits.files || []).map(file => file.filename);
      return filterJobsByChangedFiles(pushChangedFiles, jobs);
  }
};
