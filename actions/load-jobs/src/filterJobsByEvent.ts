import { Job, JobSchema } from '@monotonix/schema';
import { minimatch } from 'minimatch';
import { Event } from './schema';

type filterJobsByEventParams = {
  jobs: Job[];
  event: Event;
};
export const filterJobsByEvent = ({
  jobs,
  event,
}: filterJobsByEventParams): Job[] =>
  jobs
    .filter(job => {
      switch (event.eventName) {
        case 'push':
          if ('push' in job.on) {
            if (job.on.push?.branches) {
              const branchName = event.ref.replace(/^refs\/heads\//, '');
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
            if (job.on.pull_request?.branches) {
              const result = job.on.pull_request.branches.some(branch =>
                minimatch(event.payload.pull_request.base.ref, branch),
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
            if (job.on.pull_request_target?.branches) {
              const result = job.on.pull_request_target.branches.some(branch =>
                minimatch(event.payload.pull_request.base.ref, branch),
              );
              if (result) {
                return true;
              }
            } else {
              return true;
            }
          }

          return false;

        default:
          throw new Error(`Unsupported event: ${event.eventName}`);
      }
    })
    .map(job => JobSchema.parse(job));
