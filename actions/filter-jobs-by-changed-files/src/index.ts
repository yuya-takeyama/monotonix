import {
  exportVariable,
  getInput,
  setFailed,
  setOutput,
  warning,
} from '@actions/core';
import { JobsSchema } from '@monotonix/schema';
import { publishJobsResult, readJobsJsonInput } from '@monotonix/utils';
import { run } from './run';

(async () => {
  try {
    const githubToken = getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('Input github-token or env $GITHUB_TOKEN is required');
    }
    const jobsJson = readJobsJsonInput({
      jobs: getInput('jobs'),
      jobsFile: getInput('jobs-file'),
    });
    if (!jobsJson) {
      throw new Error(
        'Input jobs, input jobs-file, env $MONOTONIX_JOBS_FILE, or env $MONOTONIX_JOBS is required',
      );
    }
    const jobs = JobsSchema.parse(JSON.parse(jobsJson));

    const result = await run({
      githubToken,
      jobs,
    });

    publishJobsResult({
      result,
      core: { setOutput, exportVariable, warning },
    });
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
