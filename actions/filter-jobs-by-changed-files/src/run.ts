import { Jobs } from '@monotonix/schema';
import { getOctokit, context } from '@actions/github';
import { join } from 'node:path';

type runParams = {
  githubToken: string;
  jobs: Jobs;
  rootDir: string;
};
export const run = async ({ githubToken, jobs, rootDir }: runParams): Promise<Jobs> => {
  const octokit = getOctokit(githubToken);

  switch (context.eventName) {
    case 'pull_request':
    case 'pull_request_target':
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.issue.number,
      });

      return jobs.filter(job => {
        const appPath = job.context.app_path;
        const dependencies = job.app.depends_on || [];
        
        return files
          .map(file => file.filename)
          .some(file => {
            if (file.startsWith(appPath)) return true;
            
            return dependencies.some(dep => {
              const depPath = join(rootDir, dep);
              return file.startsWith(depPath);
            });
          });
      });

    default:
      const { data: commits } = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
      });

      return jobs.filter(job => {
        const appPath = job.context.app_path;
        const dependencies = job.app.depends_on || [];
        
        return (commits.files || [])
          .map(file => file.filename)
          .some(file => {
            if (file.startsWith(appPath)) return true;
            
            return dependencies.some(dep => {
              const depPath = join(rootDir, dep);
              return file.startsWith(depPath);
            });
          });
      });
  }
};
