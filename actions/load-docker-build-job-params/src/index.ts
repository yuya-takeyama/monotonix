import {
  exportVariable,
  getInput,
  setFailed,
  setOutput,
  warning,
} from '@actions/core';
import { context } from '@actions/github';
import { publishJobsResult, readJobsJsonInput } from '@monotonix/utils';
import { DateTime } from 'luxon';
import { loadGlobalConfig } from './config';
import { run } from './run';
import { InputJobsSchema } from './schema';

try {
  const globalConfigFilePath =
    getInput('global-config-file-path') || 'monotonix-global.yaml';
  const globalConfig = loadGlobalConfig(globalConfigFilePath);
  const jobsJson = readJobsJsonInput({
    jobs: getInput('jobs'),
    jobsFile: getInput('jobs-file'),
  });
  if (!jobsJson) {
    throw new Error(
      'Input jobs, input jobs-file, env $MONOTONIX_JOBS_FILE, or env $MONOTONIX_JOBS is required',
    );
  }
  const jobs = InputJobsSchema.parse(JSON.parse(jobsJson));
  const timezone = getInput('timezone');

  if (timezone && !DateTime.local().setZone(timezone).isValid) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  const result = run({ globalConfig, jobs, context, timezone });

  publishJobsResult({
    result,
    core: { setOutput, exportVariable, warning },
  });
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
