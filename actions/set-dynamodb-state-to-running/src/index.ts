import { getInput, setFailed, setOutput } from '@actions/core';
import { JobSchema } from '@monotonix/schema';
import { run } from './run';
import { parseDuration } from './utils';

(async () => {
  try {
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobJson = getInput('job');
    const job = JobSchema.parse(JSON.parse(jobJson));
    const ttlDuration = parseDuration(getInput('running-ttl'));
    const ttl = Math.floor(Date.now() / 1000) + ttlDuration;

    const result = await run({
      table,
      region,
      job,
      ttl,
    });
    setOutput('should-run', result.shouldRun ? 'true' : 'false');
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
