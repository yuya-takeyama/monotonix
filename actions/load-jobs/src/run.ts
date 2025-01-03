import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';
import { loadJobsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';

type runParams = {
  rootDir: string;
  dedupeKey: string;
  localConfigFileName: string;
  context: Context;
};
export const run = async ({
  rootDir,
  dedupeKey,
  localConfigFileName,
  context,
}: runParams) => {
  return filterJobsByGitHubContext({
    jobs: await loadJobsFromLocalConfigFiles({
      rootDir,
      dedupeKey,
      localConfigFileName,
      context,
    }),
    context,
  });
};
