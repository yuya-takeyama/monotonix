import {
  LocalConfigSchema,
  JobParam,
  LocalConfig,
  LocalConfigJob,
} from '@monotonix/schema';
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
}: loadJobConfigsFromLocalConfigFilesParams): Promise<JobParam[]> => {
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
          ([jobKey, job]): JobParam =>
            createJobParam({
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
  job: LocalConfigJob;
  context: Context;
};
export const createJobParam = ({
  localConfig,
  appPath,
  lastCommit,
  jobKey,
  job,
  context,
}: createJobConfigParams): JobParam => ({
  ...job,
  app: localConfig.app,
  app_context: {
    path: appPath,
    last_commit: lastCommit,
    label: `${localConfig.app.name} / ${jobKey}`,
  },
  params: {},
  keys: [
    ['app_path', appPath],
    ['job_key', jobKey],
    ['github_ref', context.ref],
  ],
});
