import { Context } from '@actions/github/lib/context';
import { Job, JobSchema } from '@monotonix/schema';
import { minimatch } from 'minimatch';

type filterJobsByGitHubContextParams = {
  jobs: Job[];
  context: Context;
};
export function filterJobsByGitHubContext({
  jobs,
  context,
}: filterJobsByGitHubContextParams): Job[] {
  return jobs
    .filter(job => {
      switch (context.eventName) {
        case 'push':
          if (job.on.push) {
            if (job.on.push.branches) {
              const branchName = context.ref.replace(/^refs\/heads\//, '');
              const result = job.on.push.branches.some(branch =>
                minimatch(branchName, branch),
              );
              if (result) {
                return true;
              }
            } else {
              return true;
            }
          }

        case 'pull_request':
          if (job.on.pull_request) {
            if (job.on.pull_request.branches) {
              const result = job.on.pull_request.branches.some(branch =>
                // @ts-ignore
                minimatch(context.ref_name, branch),
              );
              if (result) {
                return true;
              }
            } else {
              return true;
            }
          }

          return false;
      }
    })
    .map(job => JobSchema.parse(job));
}
