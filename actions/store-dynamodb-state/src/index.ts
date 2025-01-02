import { getInput, setFailed } from '@actions/core';
import { run } from './run';
import { Jobs, JobSchema, JobsSchema } from '@monotonix/schema';

try {
  const table = getInput('dynamodb-table');
  const region = getInput('dynamodb-region');
  const jobsJson = getInput('jobs') || process.env.MONOTONIX_JOBS;
  if (!jobsJson) {
    throw new Error('Input job or env $MONOTONIX_JOBS is required');
  }
  const jobs = parseJobs(jobsJson);
  const status = getInput('status');
  if (!(status === 'running' || status === 'success' || status === 'failure')) {
    throw new Error(
      `Invalid status: ${status}: must be one of 'running', 'success', 'failure'`,
    );
  }

  const now = Math.floor(Date.now() / 1000);
  let ttl: number | null = null;
  if (getInput('ttl-in-days')) {
    ttl = now + Number(getInput('ttl-in-days')) * 24 * 60 * 60;
  } else if (getInput('ttl-in-hours')) {
    ttl = now + Number(getInput('ttl-in-hours')) * 60 * 60;
  } else if (getInput('ttl-in-minutes')) {
    ttl = now + Number(getInput('ttl-in-minutes')) * 60;
  }

  run({
    jobs,
    table,
    region,
    status,
    ttl,
  });
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}

function parseJobs(jobsJson: string): Jobs {
  if (isArrayJson(jobsJson)) {
    return JobsSchema.parse(JSON.parse(jobsJson));
  } else {
    return [JobSchema.parse(JSON.parse(jobsJson))];
  }
}

function isArrayJson(value: string): boolean {
  return value.trim().startsWith('[');
}
