import { exportVariable, getInput, setFailed, setOutput } from '@actions/core';
import { run } from './run';
import { JobsSchema } from '@monotonix/schema';

(async () => {
  try {
    const githubToken = getInput('github-token') || process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error('Input github-token or env $GITHUB_TOKEN is required');
    }
    const jobsJson = getInput('jobs') || process.env.MONOTONIX_JOBS;
    if (!jobsJson) {
      throw new Error('Input job or env $MONOTONIX_JOBS is required');
    }
    const rootDir = getInput('root-dir');
    if (!rootDir) {
      throw new Error('Input root-dir is required');
    }
    const jobs = JobsSchema.parse(JSON.parse(jobsJson));

    const result = await run({
      githubToken,
      jobs,
      rootDir,
    });

    setOutput('result', result);
    exportVariable('MONOTONIX_JOBS', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
