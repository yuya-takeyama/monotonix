import { filterJobParamsByGitHubContext } from './filterJobConfigsByGitHubContext';
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
  return filterJobParamsByGitHubContext({
    jobParams: await loadJobConfigsFromLocalConfigFiles({
      rootDir,
      localConfigFileName,
      context,
    }),
    context,
  });
};
