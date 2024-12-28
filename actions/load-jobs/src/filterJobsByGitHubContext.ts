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
            return job.on.push.branches.some(branch =>
              minimatch(context.ref, branch),
            );
          } else {
            return true;
          }
        }

      case 'pull_request':
        if (job.on.pull_request) {
          if (job.on.pull_request.branches) {
            return job.on.pull_request.branches.some(branch =>
              minimatch(context.ref, branch),
            );
          } else {
            return true;
          }
        }

      default:
        throw new Error(`Unsupported event: ${context.eventName}`);
    }
  });
}
