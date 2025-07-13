import { LocalConfigSchema } from '@monotonix/schema';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { join, dirname } from 'node:path';

/**
 * アプリ情報の型定義
 */
export type AppInfo = {
  name: string;
  appPath: string;
  dependsOn: string[];
};

/**
 * すべてのmonotonix.yamlファイルを独立してスキャンし、完全なアプリ依存関係マップを構築
 */
export const loadAllAppConfigs = (rootDir: string = 'apps'): AppInfo[] => {
  console.log('🔍 [DEBUG] loadAllAppConfigs scanning directory:', rootDir);
  
  const pattern = join(rootDir, '**', 'monotonix.yaml');
  const configPaths = globSync(pattern);
  console.log('🔍 [DEBUG] found config files:', configPaths);

  const appInfos: AppInfo[] = [];

  for (const configPath of configPaths) {
    try {
      const appPath = dirname(configPath);
      const configContent = readFileSync(configPath, 'utf-8');
      const config = LocalConfigSchema.parse(load(configContent));
      
      console.log('🔍 [DEBUG] raw config.app:', config.app);
      console.log('🔍 [DEBUG] config.app.depends_on:', (config.app as any).depends_on);
      console.log('🔍 [DEBUG] typeof depends_on:', typeof (config.app as any).depends_on);
      
      const appInfo: AppInfo = {
        name: config.app.name,
        appPath,
        dependsOn: (config.app as any).depends_on || [],
      };
      
      appInfos.push(appInfo);
      console.log('🔍 [DEBUG] loaded app config:', appInfo);
    } catch (err) {
      console.warn(`⚠️  Failed to load config: ${configPath}: ${err}`);
    }
  }

  return appInfos;
};

/**
 * ファイル変更から影響を受けるアプリを特定（完全なアプリ設定を使用）
 */
export const getAffectedAppsFromChangedFiles = (
  changedFiles: string[],
  allAppConfigs: AppInfo[],
): string[] => {
  // app_pathからアプリ名へのマッピングを作成（パス長順でソート、長い方が優先）
  const appPathEntries = allAppConfigs
    .map(app => [app.appPath, app.name] as [string, string])
    .sort(([a], [b]) => b.length - a.length);

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
 * アプリベースの依存関係伝播（完全なアプリ設定を使用）
 */
export const propagateAppDependencies = (
  affectedApps: string[],
  allAppConfigs: AppInfo[],
): string[] => {
  // アプリ名から依存関係マップを作成
  const appDependencies = new Map<string, string[]>();
  for (const appConfig of allAppConfigs) {
    if (appConfig.dependsOn.length > 0) {
      appDependencies.set(appConfig.name, appConfig.dependsOn);
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