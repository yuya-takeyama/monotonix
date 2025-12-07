import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { App as BaseApp, LocalConfigSchema } from '@monotonix/schema';
import { extractAppLabel } from '@monotonix/utils';
import { globSync } from 'glob';
import { load } from 'js-yaml';

type LoadAppsFromLocalConfigFilesOptions = {
  rootDir: string;
  localConfigFileName: string;
};

export type App = BaseApp & {
  app_path: string;
  label: string;
};

export type Apps = App[];

export const loadAppsFromLocalConfigFiles = async ({
  rootDir,
  localConfigFileName,
}: LoadAppsFromLocalConfigFilesOptions): Promise<Apps> => {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);
  const apps: Apps = [];

  for (const localConfigPath of localConfigPaths) {
    try {
      const localConfigContent = readFileSync(localConfigPath, 'utf-8');
      const localConfig = LocalConfigSchema.parse(load(localConfigContent));
      const appPath = dirname(localConfigPath);

      const app: App = {
        app_path: appPath,
        label: extractAppLabel(appPath, rootDir),
        ...localConfig.app,
      };

      apps.push(app);
    } catch (err) {
      throw new Error(
        `Failed to parse ${localConfigPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return apps;
};
