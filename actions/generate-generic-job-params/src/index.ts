import { getInput, setFailed, setOutput } from '@actions/core';
import { run } from './run';

try {
  const jobType = getInput('job-type');
  const jobConfigs = getInput('job-configs');

  const jobParams = run(jobType, jobConfigs);

  setOutput('result', JSON.stringify(jobParams));
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
