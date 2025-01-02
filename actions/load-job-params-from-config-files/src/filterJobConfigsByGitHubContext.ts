import { Context } from '@actions/github/lib/context';
import { JobParam, JobParamSchema } from '@monotonix/schema';
import { minimatch } from 'minimatch';

type filterJobConfigsByGitHubContextParams = {
  jobParams: JobParam[];
  context: Context;
};
export function filterJobParamsByGitHubContext({
  jobParams,
  context,
}: filterJobConfigsByGitHubContextParams): JobParam[] {
  return jobParams
    .filter(jobParam => {
      switch (context.eventName) {
        case 'push':
          if (jobParam.on.push) {
            if (jobParam.on.push.branches) {
              const branchName = context.ref.replace(/^refs\/heads\//, '');
              const result = jobParam.on.push.branches.some(branch =>
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
          if (jobParam.on.pull_request) {
            if (jobParam.on.pull_request.branches) {
              const result = jobParam.on.pull_request.branches.some(branch =>
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
    .map(jobParam => JobParamSchema.parse(jobParam));
}
