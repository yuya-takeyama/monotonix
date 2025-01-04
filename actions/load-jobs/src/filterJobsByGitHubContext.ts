import { Context } from '@actions/github/lib/context';
import { Job, JobSchema } from '@monotonix/schema';
import { minimatch } from 'minimatch';
//import { EventSchema } from './schema';

type filterJobsByGitHubContextParams = {
  jobs: Job[];
  context: Context;
};
export const filterJobsByGitHubContext = ({
  jobs,
  context,
}: filterJobsByGitHubContextParams): Job[] =>
  jobs
    .filter(job => {
      console.log(JSON.stringify(context));
      switch (context.eventName) {
        case 'push':
          if ('push' in job.on) {
            if (job.on.push && job.on.push.branches) {
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

          return false;

        case 'pull_request':
          if ('pull_request' in job.on) {
            if (job.on.pull_request && job.on.pull_request.branches) {
              const result = job.on.pull_request.branches.some(branch =>
                // @ts-ignore
                minimatch(context.base_ref, branch),
              );
              if (result) {
                return true;
              }
            } else {
              return true;
            }
          }

          return false;

        case 'pull_request_target':
          if ('pull_request_target' in job.on) {
            if (
              job.on.pull_request_target &&
              job.on.pull_request_target.branches
            ) {
              const result = job.on.pull_request_target.branches.some(branch =>
                // @ts-ignore
                minimatch(context.base_ref, branch),
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
