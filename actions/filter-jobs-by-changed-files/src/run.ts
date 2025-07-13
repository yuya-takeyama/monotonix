import { Jobs } from '@monotonix/schema';
import { getOctokit, context } from '@actions/github';
import { filterJobsByAppDependencies } from './propagateAppDependencies';

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

      const prChangedFiles = files.map(file => file.filename);
      return filterJobsByAppDependencies(prChangedFiles, jobs);

    default:
      const { data: commits } = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
      });

      const pushChangedFiles = (commits.files || []).map(file => file.filename);
      return filterJobsByAppDependencies(pushChangedFiles, jobs);
  }
};
