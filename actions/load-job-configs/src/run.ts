import { filterJobConfigsByGitHubContext } from './filterJobConfigsByGitHubContext';
import { loadJobConfigsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';

type runParams = {
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export function run({ rootDir, localConfigFileName, context }: runParams) {
  return filterJobConfigsByGitHubContext({
    jobConfigs: loadJobConfigsFromLocalConfigFiles({
      rootDir,
      localConfigFileName,
      context,
    }),
    context,
  });
}
