import { getInput, setFailed } from '@actions/core';
import { JobSchema } from '@monotonix/schema';
import { run } from './run';
import { parseDuration } from './utils';

try {
  const table = getInput('dynamodb-table');
  const region = getInput('dynamodb-region');
  const jobJson = getInput('job');
  const job = JobSchema.parse(JSON.parse(jobJson));
  const ttlDuration = parseDuration(getInput('running-ttl'));
  const ttl = Math.floor(Date.now() / 1000) + ttlDuration;

  run({
    table,
    region,
    job,
    ttl,
  });
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
