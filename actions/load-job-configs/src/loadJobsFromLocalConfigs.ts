import { LocalConfigSchema, JobConfig } from '@monotonix/schema';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { join, dirname } from 'node:path';
import { Context } from '@actions/github/lib/context';

export function loadJobConfigsFromLocalConfigFiles(
  rootDir: string,
  localConfigFileName: string,
  context: Context,
): JobConfig[] {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);
  return localConfigPaths.flatMap(localConfigPath => {
    const appPath = dirname(localConfigPath);
    try {
      const localConfigContent = readFileSync(localConfigPath, 'utf-8');
      const config = LocalConfigSchema.parse(load(localConfigContent));
      return Object.entries(config.jobs).map(
        ([jobKey, job]): JobConfig => ({
          app: config.app,
          app_context: {
            path: appPath,
          },
          on: job.on,
          type: job.type,
          config: job.config,
          keys: [
            ['app_path', appPath],
            ['job_key', jobKey],
            ['job_type', job.type],
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
