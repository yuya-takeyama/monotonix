import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';
import { loadJobsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';

type runParams = {
  rootDir: string;
  dedupeKey: string;
  requiredConfigKeys: string[];
  localConfigFileName: string;
  context: Context;
};
export const run = async ({
  rootDir,
  dedupeKey,
  requiredConfigKeys,
  localConfigFileName,
  context,
}: runParams) => {
  return filterJobsByGitHubContext({
    jobs: await loadJobsFromLocalConfigFiles({
      rootDir,
      dedupeKey,
      requiredConfigKeys,
      localConfigFileName,
      context,
    }),
    context,
  });
};
