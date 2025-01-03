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
  dedupeKey: string;
  requiredConfigKeys: string[];
  localConfigFileName: string;
  context: Context;
};
export const loadJobsFromLocalConfigFiles = async ({
  rootDir,
  dedupeKey,
  requiredConfigKeys,
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
              dedupeKey,
              appPath,
              lastCommit,
              jobKey,
              job,
              githubContext: context,
            }),
        );
      } catch (err) {
        throw new Error(
          `Failed to load local config: ${localConfigPath}: ${err}`,
        );
      }
    }),
  );

  return jobs
    .flat()
    .filter(job => requiredConfigKeys.every(key => job.configs[key]));
};

type createJobParams = {
  localConfig: LocalConfig;
  dedupeKey: string;
  appPath: string;
  lastCommit: CommitInfo;
  jobKey: string;
  job: LocalConfigJob;
  githubContext: Context;
};
export const createJob = ({
  localConfig,
  dedupeKey,
  appPath,
  lastCommit,
  jobKey,
  job,
  githubContext,
}: createJobParams): Job => ({
  ...job,
  app: localConfig.app,
  context: {
    dedupe_key: dedupeKey,
    github_ref: githubContext.ref,
    app_path: appPath,
    job_key: jobKey,
    last_commit: lastCommit,
    label: `${localConfig.app.name} / ${jobKey}`,
  },
  params: {},
});
