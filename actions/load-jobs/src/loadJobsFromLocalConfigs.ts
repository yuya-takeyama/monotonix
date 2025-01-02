import {
  LocalConfigSchema,
  Job,
  Jobs,
  LocalConfig,
  LocalConfigJob,
} from '@monotonix/schema';
import { load } from 'js-yaml';
import { readFileSync } from 'node:fs';
import { globSync } from 'glob';
import { join, dirname } from 'node:path';
import { Context } from '@actions/github/lib/context';
import { CommitInfo, getLastCommit } from './getLastCommit';

type loadJobsFromLocalConfigFilesParams = {
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export const loadJobsFromLocalConfigFiles = async ({
  rootDir,
  localConfigFileName,
  context,
}: loadJobsFromLocalConfigFilesParams): Promise<Jobs> => {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);

  const jobs = await Promise.all(
    localConfigPaths.map(async localConfigPath => {
      const appPath = dirname(localConfigPath);
      const lastCommit = await getLastCommit(appPath);
      try {
        const localConfigContent = readFileSync(localConfigPath, 'utf-8');
        const localConfig = LocalConfigSchema.parse(load(localConfigContent));
        return Object.entries(localConfig.jobs).map(
          ([jobKey, job]): Job =>
            createJob({
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

  return jobs.flat();
};

type createJobParams = {
  localConfig: LocalConfig;
  appPath: string;
  lastCommit: CommitInfo;
  jobKey: string;
  job: LocalConfigJob;
  context: Context;
};
export const createJob = ({
  localConfig,
  appPath,
  lastCommit,
  jobKey,
  job,
  context,
}: createJobParams): Job => ({
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
