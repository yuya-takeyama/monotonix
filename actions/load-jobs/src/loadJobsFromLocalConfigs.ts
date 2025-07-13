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
import { CommitInfo, getLastCommit } from './getLastCommit';
import { Event } from './schema';
import { calculateEffectiveTimestamps } from './calculateEffectiveTimestamp';

type loadJobsFromLocalConfigFilesParams = {
  rootDir: string;
  dedupeKey: string;
  requiredConfigKeys: string[];
  localConfigFileName: string;
  event: Event;
};
export const loadJobsFromLocalConfigFiles = async ({
  rootDir,
  dedupeKey,
  requiredConfigKeys,
  localConfigFileName,
  event,
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
              event,
            }),
        );
      } catch (err) {
        throw new Error(
          `Failed to load local config: ${localConfigPath}: ${err}`,
        );
      }
    }),
  );

  const flatJobs = jobs.flat();
  
  // Create app name to path mapping for all apps (before filtering)
  const appNameToPath = new Map<string, string>();
  for (const job of flatJobs) {
    appNameToPath.set(job.app.name, job.context.app_path);
  }

  // Filter jobs by required config keys
  const filteredJobs = flatJobs.filter(job => 
    requiredConfigKeys.every(key => key in job.configs)
  );

  return await calculateEffectiveTimestamps(filteredJobs, appNameToPath);
};

type createJobParams = {
  localConfig: LocalConfig;
  dedupeKey: string;
  appPath: string;
  lastCommit: CommitInfo;
  jobKey: string;
  job: LocalConfigJob;
  event: Event;
};
export const createJob = ({
  localConfig,
  dedupeKey,
  appPath,
  lastCommit,
  jobKey,
  job,
  event,
}: createJobParams): Job => ({
  ...job,
  app: localConfig.app,
  context: {
    dedupe_key: dedupeKey,
    github_ref: event.ref,
    app_path: appPath,
    job_key: jobKey,
    last_commit: lastCommit,
    label: `${localConfig.app.name} / ${jobKey}`,
  },
  params: {},
});
