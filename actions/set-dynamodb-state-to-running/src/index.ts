import { getInput, saveState, setFailed } from '@actions/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getRunId, parseDuration } from '@monotonix/dynamodb-common';
import { JobSchema } from '@monotonix/schema';
import { run } from './run';
import { ACQUIRED_STATE, saveAwsCredentialsIntoState } from './utils';

(async () => {
  try {
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobJson = getInput('job');
    const job = JobSchema.parse(JSON.parse(jobJson));
    const ttlSeconds = parseDuration(getInput('running-ttl'));

    const outcome = await run({
      docClient: DynamoDBDocumentClient.from(new DynamoDBClient({ region })),
      table,
      job,
      runId: getRunId(),
      now: Math.floor(Date.now() / 1000),
      ttlSeconds,
    });

    if (outcome === 'acquired') {
      saveAwsCredentialsIntoState();
      saveState(ACQUIRED_STATE, 'true');
    }
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
