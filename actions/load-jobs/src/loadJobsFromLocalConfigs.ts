import { LocalConfigSchema, Job } from '@monotonix/schema';
import { load } from 'js-yaml';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadJobsFromLocalConfigs(
  rootDir: string,
  localConfigFileName: string,
): Job[] {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);
  return localConfigPaths.flatMap(localConfigPath => {
    try {
      const localConfigContent = readFileSync(localConfigPath, 'utf-8');
      const config = LocalConfigSchema.parse(load(localConfigContent));
      return Object.values(config.jobs).map(job => ({
        app: {
          ...config.app,
          path: localConfigPath,
        },
        ...job,
      }));
    } catch (err) {
      throw new Error(
        `Failed to load local config: ${localConfigPath}: ${err}`,
      );
    }
  });
}
