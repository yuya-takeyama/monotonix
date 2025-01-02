import { getInput, setFailed, setOutput, exportVariable } from '@actions/core';
import { context } from '@actions/github';
import { loadGlobalConfig } from './config';
import { run } from './run';

try {
  const globalConfigFilePath =
    getInput('global-config-file-path') || 'monotonix-global.yaml';
  const globalConfig = loadGlobalConfig(globalConfigFilePath);
  const jobParams = getInput('job-params') || process.env.MONOTONIX_JOB_PARAMS;
  if (!jobParams) {
    throw new Error(
      'Input job-params or env $MONOTONIX_JOB_PARAMS is required',
    );
  }

  const result = run({ globalConfig, jobParams, context });

  setOutput('result', result);
  exportVariable('MONOTONIX_JOB_PARAMS', result);
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
