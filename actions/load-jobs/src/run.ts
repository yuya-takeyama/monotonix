import { filterJobsByEvent } from './filterJobsByEvent';
import { loadJobsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Event } from './schema';

type runParams = {
  rootDir: string;
  dedupeKey: string;
  requiredConfigKeys: string[];
  localConfigFileName: string;
  event: Event;
};
export const run = async ({
  rootDir,
  dedupeKey,
  requiredConfigKeys,
  localConfigFileName,
  event,
}: runParams) => {
  return filterJobsByEvent({
    jobs: await loadJobsFromLocalConfigFiles({
      rootDir,
      dedupeKey,
      requiredConfigKeys,
      localConfigFileName,
      event,
    }),
    event,
  });
};
