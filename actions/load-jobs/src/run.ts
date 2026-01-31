import { filterJobsByEvent } from './filterJobsByEvent';
import { loadJobsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Event } from './schema';

type runParams = {
  rootDir: string;
  repositoryRoot: string;
  dedupeKey: string;
  requiredConfigKeys: string[];
  localConfigFileName: string;
  event: Event;
};
export const run = async ({
  rootDir,
  repositoryRoot,
  dedupeKey,
  requiredConfigKeys,
  localConfigFileName,
  event,
}: runParams) => {
  return filterJobsByEvent({
    jobs: await loadJobsFromLocalConfigFiles({
      rootDir,
      repositoryRoot,
      dedupeKey,
      requiredConfigKeys,
      localConfigFileName,
      event,
    }),
    event,
  });
};
