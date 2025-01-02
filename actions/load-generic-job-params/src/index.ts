import { getInput, setFailed, setOutput, exportVariable } from '@actions/core';
import { run } from './run';

try {
  const configKey = getInput('config-key');
  const jobParams = getInput('job-params') || process.env.MONOTONIX_JOB_PARAMS;
  if (!jobParams) {
    throw new Error(
      'Input job-params or env $MONOTONIX_JOB_PARAMS is required',
    );
  }

  const result = JSON.stringify(run(configKey, jobParams));

  setOutput('result', result);
  exportVariable('MONOTONIX_JOB_PARAMS', result);
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
