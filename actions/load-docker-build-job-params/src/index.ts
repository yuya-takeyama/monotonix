import { exportVariable, getInput, setFailed, setOutput } from '@actions/core';
import { context } from '@actions/github';
import { DateTime } from 'luxon';
import { loadGlobalConfig } from './config';
import { run } from './run';
import { InputJobsSchema } from './schema';

try {
  const globalConfigFilePath =
    getInput('global-config-file-path') || 'monotonix-global.yaml';
  const globalConfig = loadGlobalConfig(globalConfigFilePath);
  const jobsJson = getInput('jobs') || process.env.MONOTONIX_JOBS;
  if (!jobsJson) {
    throw new Error('Input jobs or env $MONOTONIX_JOBS is required');
  }
  const jobs = InputJobsSchema.parse(JSON.parse(jobsJson));
  const timezone = getInput('timezone');

  if (timezone && !DateTime.local().setZone(timezone).isValid) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const result = run({ globalConfig, jobs, context, timezone });

  setOutput('result', result);
  exportVariable('MONOTONIX_JOBS', result);
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
