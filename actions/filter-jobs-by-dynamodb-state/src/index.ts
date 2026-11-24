import {
  exportVariable,
  getInput,
  setFailed,
  setOutput,
  warning,
} from '@actions/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getRunId, parseDuration } from '@monotonix/dynamodb-common';
import { JobsSchema } from '@monotonix/schema';
import { publishJobsResult, readJobsJsonInput } from '@monotonix/utils';
import { run } from './run';

(async () => {
  try {
    const table = getInput('dynamodb-table');
    const region = getInput('dynamodb-region');
    const jobsJson = readJobsJsonInput({
      jobs: getInput('jobs'),
      jobsFile: getInput('jobs-file'),
    });
    if (!jobsJson) {
      throw new Error(
        'Input jobs, input jobs-file, env $MONOTONIX_JOBS_FILE, or env $MONOTONIX_JOBS is required',
      );
    }
    const jobs = JobsSchema.parse(JSON.parse(jobsJson));
    const ttlSeconds = parseDuration(getInput('claim-ttl'));
    const runId = getRunId();

    const result = await run({
      docClient: DynamoDBDocumentClient.from(new DynamoDBClient({ region })),
      table,
      jobs,
      runId,
      now: Math.floor(Date.now() / 1000),
      ttlSeconds,
    });

    publishJobsResult({
      result,
      core: { setOutput, exportVariable, warning },
    });
  } catch (error) {
    console.error(error);
    setFailed(`Action failed with error: ${error}`);
  }
})();
