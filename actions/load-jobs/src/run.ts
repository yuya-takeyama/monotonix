import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';
import { loadJobsFromLocalConfigs } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';

type runParams = {
  rootDir: string;
  localConfigFileName: string;
  context: Context;
};
export function run({ rootDir, localConfigFileName, context }: runParams) {
  const jobs = loadJobsFromLocalConfigs(rootDir, localConfigFileName);
  console.log('JOBS:');
  console.log(JSON.stringify(jobs, null, 2));

  const filteredJobs = filterJobsByGitHubContext(jobs, context);
  console.log('FILTERED JOBS:');
  console.log(JSON.stringify(filteredJobs, null, 2));

  return filteredJobs;
}
