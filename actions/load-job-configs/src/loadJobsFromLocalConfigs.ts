import { LocalConfigSchema, JobConfig, LocalConfig } from '@monotonix/schema';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { join, dirname } from 'node:path';
import { Context } from '@actions/github/lib/context';

type loadJobConfigsFromLocalConfigFilesParams = {
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export function loadJobConfigsFromLocalConfigFiles({
  rootDir,
  localConfigFileName,
  context,
}: loadJobConfigsFromLocalConfigFilesParams): JobConfig[] {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);
  return localConfigPaths.flatMap(localConfigPath => {
    const appPath = dirname(localConfigPath);
    try {
      const localConfigContent = readFileSync(localConfigPath, 'utf-8');
      const localConfig = LocalConfigSchema.parse(load(localConfigContent));
      return Object.entries(localConfig.jobs).map(
        ([jobKey, job]): JobConfig =>
          createJobConfig({
            localConfig,
            appPath,
            jobKey,
            job,
            context,
          }),
      );
    } catch (err) {
      throw new Error(
        `Failed to load local config: ${localConfigPath}: ${err}`,
      );
    }
  });
}

type createJobConfigParams = {
  localConfig: LocalConfig;
  appPath: string;
  jobKey: string;
  job: any;
  context: Context;
};
export const createJobConfig = ({
  localConfig,
  appPath,
  jobKey,
  job,
  context,
}: createJobConfigParams): JobConfig => ({
  app: localConfig.app,
  app_context: {
    path: appPath,
  },
  on: job.on,
  type: job.type,
  config: job.config,
  keys: [
    ['app_path', appPath],
    ['job_key', jobKey],
    ['github_ref', context.ref],
  ],
});
