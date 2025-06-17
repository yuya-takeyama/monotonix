import { Jobs } from '@monotonix/schema';
import { getOctokit, context } from '@actions/github';
import { propagateDependencyChanges } from './propagateDependencyChanges';

type runParams = {
  githubToken: string;
  jobs: Jobs;
};
export const run = async ({ githubToken, jobs }: runParams): Promise<Jobs> => {
  const octokit = getOctokit(githubToken);

  switch (context.eventName) {
    case 'pull_request':
    case 'pull_request_target':
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.issue.number,
      });

      const prChangedJobs = jobs.filter(job => {
        return files
          .map(file => file.filename)
          .some(file => file.startsWith(job.context.app_path));
      });

      return propagateDependencyChanges(jobs, prChangedJobs);

    default:
      const { data: commits } = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
      });

      const pushChangedJobs = jobs.filter(job => {
        return (commits.files || [])
          .map(file => file.filename)
          .some(file => file.startsWith(job.context.app_path));
      });

      return propagateDependencyChanges(jobs, pushChangedJobs);
  }
};
