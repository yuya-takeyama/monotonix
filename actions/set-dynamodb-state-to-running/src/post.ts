import { getInput, setFailed } from '@actions/core';
import { runPost } from './runPost';
import { JobSchema } from '@monotonix/schema';
import { getAwsCredentialsFromState, parseDuration } from './utils';

const wrappedRunPost = wrapFunctionWithEnv(
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

  wrappedRunPost({
    table,
    region,
    job,
    jobStatus,
    ttl,
  });
  console.log('After runPost');
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}

function wrapFunctionWithEnv<T extends (...args: any[]) => any>(
  originalFunction: T,
  tempEnv: Record<string, string | undefined>,
): (...args: Parameters<T>) => ReturnType<T> {
  return (...args: Parameters<T>): ReturnType<T> => {
    const originalEnv: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(tempEnv)) {
      originalEnv[key] = process.env[key];
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    try {
      return originalFunction(...args);
    } finally {
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value !== undefined) {
          process.env[key] = value;
        } else {
          delete process.env[key];
        }
      }
    }
  };
}
