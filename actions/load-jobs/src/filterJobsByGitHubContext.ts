import { Context } from '@actions/github/lib/context';
import { Job } from '@monotonix/schema';
import { minimatch } from 'minimatch';

export function filterJobsByGitHubContext(
  jobs: Job[],
  context: Context,
): Job[] {
  return jobs.filter(job => {
    switch (context.eventName) {
      case 'push':
        if (job.on.push) {
          if (job.on.push.branches) {
            const result = job.on.push.branches.some(branch =>
              minimatch(context.ref, branch),
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
              minimatch(context.ref, branch),
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
  });
}
