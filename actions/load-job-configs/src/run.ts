import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';
import { loadJobConfigsFromLocalConfigFiles } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';

type runParams = {
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export function run({ rootDir, localConfigFileName, context }: runParams) {
  const jobs = loadJobConfigsFromLocalConfigFiles(
    rootDir,
    localConfigFileName,
    context,
  );

  const filteredJobs = filterJobsByGitHubContext(jobs, context);

  return filteredJobs;
}
