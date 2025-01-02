import { getInput, setFailed } from '@actions/core';
import { run } from './run';
import { JobSchema } from '@monotonix/schema';
import { context } from '@actions/github';

try {
  const workflowId =
    getInput('workflow-id') || process.env.MONOTONIX_WORKFLOW_ID;
  if (!workflowId) {
    throw new Error(
      'Input workflow-id or env $MONOTONIX_WORKFLOW_ID is required',
    );
  }
  const table = getInput('dynamodb-table');
  const region = getInput('dynamodb-region');
  const jobJson = getInput('job');
  const job = JobSchema.parse(jobJson);
  const status = getInput('status');
  if (
    !(status === 'success' || status === 'failure' || status === 'cancelled')
  ) {
    throw new Error(
      `Invalid status: ${status}: must be one of 'success', 'failure', or 'cancelled'`,
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
    workflowId,
    githubRef: context.ref,
    job,
    table,
    region,
    status,
    ttl,
  });
} catch (error) {
  console.error(error);
  setFailed(`Action failed with error: ${error}`);
}
