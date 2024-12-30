import { LocalConfigSchema, JobConfig } from '@monotonix/schema';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { join } from 'node:path';
import { Context } from '@actions/github/lib/context';

export function loadJobConfigsFromLocalConfigFiles(
  rootDir: string,
  localConfigFileName: string,
  context: Context,
): JobConfig[] {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);
  return localConfigPaths.flatMap(localConfigPath => {
    try {
      const localConfigContent = readFileSync(localConfigPath, 'utf-8');
      const config = LocalConfigSchema.parse(load(localConfigContent));
      return Object.entries(config.jobs).map(
        ([jobKey, job]): JobConfig => ({
          app: config.app,
          app_context: {
            path: localConfigPath,
          },
          on: job.on,
          config: job.config,
          keys: [
            ['app_path', localConfigPath],
            ['job_key', jobKey],
            ['job_type', job.config.job_type],
            ['github_ref', context.ref],
          ],
        }),
      );
    } catch (err) {
      throw new Error(
        `Failed to load local config: ${localConfigPath}: ${err}`,
      );
    }
  });
}
