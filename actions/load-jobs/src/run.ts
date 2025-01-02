import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';
import { loadJobsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';

type runParams = {
  workflowId: string;
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export const run = async ({
  workflowId,
  rootDir,
  localConfigFileName,
  context,
}: runParams) => {
  return filterJobsByGitHubContext({
    jobs: await loadJobsFromLocalConfigFiles({
      workflowId,
      rootDir,
      localConfigFileName,
      context,
    }),
    context,
  });
};
