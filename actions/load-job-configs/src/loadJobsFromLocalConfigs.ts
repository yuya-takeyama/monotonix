import { LocalConfigSchema, JobConfig, LocalConfig } from '@monotonix/schema';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { join, dirname } from 'node:path';
import { Context } from '@actions/github/lib/context';
import { CommitInfo, getLastCommit } from './getLastCommit';

type loadJobConfigsFromLocalConfigFilesParams = {
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export const loadJobConfigsFromLocalConfigFiles = async ({
  rootDir,
  localConfigFileName,
  context,
}: loadJobConfigsFromLocalConfigFilesParams): Promise<JobConfig[]> => {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);

  const jobConfigs = await Promise.all(
    localConfigPaths.map(async localConfigPath => {
      const appPath = dirname(localConfigPath);
      const lastCommit = await getLastCommit(appPath);
      try {
        const localConfigContent = readFileSync(localConfigPath, 'utf-8');
        const localConfig = LocalConfigSchema.parse(load(localConfigContent));
        return Object.entries(localConfig.jobs).map(
          ([jobKey, job]): JobConfig =>
            createJobConfig({
              localConfig,
              appPath,
              lastCommit,
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
    }),
  );

  return jobConfigs.flat();
};

type createJobConfigParams = {
  localConfig: LocalConfig;
  appPath: string;
  lastCommit: CommitInfo;
  jobKey: string;
  job: any;
  context: Context;
};
export const createJobConfig = ({
  localConfig,
  appPath,
  lastCommit,
  jobKey,
  job,
  context,
}: createJobConfigParams): JobConfig => ({
  app: localConfig.app,
  app_context: {
    path: appPath,
    last_commit: lastCommit,
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
