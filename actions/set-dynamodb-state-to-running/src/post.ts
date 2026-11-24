import { getInput, getState, info, setFailed } from '@actions/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getRunId, parseDuration } from '@monotonix/dynamodb-common';
import { JobSchema } from '@monotonix/schema';
import { runPost } from './runPost';
import { ACQUIRED_STATE, getAwsCredentialsFromState } from './utils';

(async () => {
  try {
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobJson = getInput('job');
    const job = JobSchema.parse(JSON.parse(jobJson));
    if (getState(ACQUIRED_STATE) !== 'true') {
      info(
        `${job.context.label}: Skip: This job did not acquire the running state`,
      );
      return;
    }
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

    await runPost({
      docClient: DynamoDBDocumentClient.from(
        new DynamoDBClient({
          region,
          credentials: getAwsCredentialsFromState(),
        }),
      ),
      table,
      job,
      jobStatus,
      runId: getRunId(),
      ttl,
    });
  } catch (error) {
    setFailed(`Action failed with error: ${error}`);
  }
})();
