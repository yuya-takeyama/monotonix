import { getInput, setFailed } from '@actions/core';
import { JobSchema } from '@monotonix/schema';
import { runPost } from './runPost';
import {
  getAwsCredentialsFromState,
  parseDuration,
  wrapFunctionWithEnv,
} from './utils';

const runPostWithAwsCredentials = wrapFunctionWithEnv(
  runPost,
  getAwsCredentialsFromState(),
);

try {
  const table = getInput('dynamodb-table');
  const region = getInput('dynamodb-region');
  const jobJson = getInput('job');
  const job = JobSchema.parse(JSON.parse(jobJson));
  const jobStatus = getInput('job-status');
  if (
    jobStatus !== 'success' &&
    jobStatus !== 'failure' &&
    jobStatus !== 'cancelled'
  ) {
    throw new Error(`Invalid job status: ${jobStatus}`);
  }
  const ttlDuration = parseDuration(getInput('success-ttl'));
  const ttl = Math.floor(Date.now() / 1000) + ttlDuration;

  runPostWithAwsCredentials({
    table,
    region,
    job,
    jobStatus,
    ttl,
  });
} catch (error) {
  setFailed(`Action failed with error: ${error}`);
}
