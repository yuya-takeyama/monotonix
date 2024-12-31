import { getInput, setFailed } from '@actions/core';
import { run } from './run';

try {
  const table = getInput('dynamodb-table');
  const region = getInput('dynamodb-region');
  const jobParams = getInput('job-params');

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
    jobParams,
    table,
    region,
    ttl,
  });
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
