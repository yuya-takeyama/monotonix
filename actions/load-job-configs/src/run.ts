import { filterJobConfigsByGitHubContext } from './filterJobConfigsByGitHubContext';
import { loadJobConfigsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';

type runParams = {
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export const run = async ({
  rootDir,
  localConfigFileName,
  context,
}: runParams) => {
  return filterJobConfigsByGitHubContext({
    jobConfigs: await loadJobConfigsFromLocalConfigFiles({
      rootDir,
      localConfigFileName,
      context,
    }),
    context,
  });
};
