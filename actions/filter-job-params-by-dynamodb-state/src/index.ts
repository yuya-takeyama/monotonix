import { exportVariable, getInput, setFailed, setOutput } from '@actions/core';
import { run } from './run';

(async () => {
  try {
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobParams =
      getInput('job-params') || process.env.MONOTONIX_JOB_PARAMS;
    if (!jobParams) {
      throw new Error(
        'Input job-params or env $MONOTONIX_JOB_PARAMS is required',
      );
    }

    const result = JSON.stringify(
      await run({
        jobParams,
        table,
        region,
      }),
    );

    setOutput('result', result);
    exportVariable('MONOTONIX_JOB_PARAMS', result);
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
