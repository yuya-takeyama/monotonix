import { exportVariable, getInput, setFailed, setOutput } from '@actions/core';
import { run } from './run';
import { JobsSchema } from '@monotonix/schema';

(async () => {
  try {
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobsJson = getInput('jobs') || process.env.MONOTONIX_JOBS;
    if (!jobsJson) {
      throw new Error('Input job or env $MONOTONIX_JOBS is required');
    }
    const jobs = JobsSchema.parse(JSON.parse(jobsJson));

    const result = await run({
      jobs,
      table,
      region,
    });

    setOutput('result', result);
    exportVariable('MONOTONIX_JOBS', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
