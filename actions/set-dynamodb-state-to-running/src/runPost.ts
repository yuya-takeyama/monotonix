import { notice } from '@actions/core';
import { type DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  type HeldStatus,
  isConditionalCheckFailed,
  releaseState,
  StateItem,
  stateKey,
} from '@monotonix/dynamodb-common';
import { Job } from '@monotonix/schema';

type runPostParam = {
  docClient: DynamoDBDocumentClient;
  table: string;
  job: Job;
  acquired: boolean;
  jobStatus: 'success' | 'failure' | 'cancelled';
  runId: string;
  ttl: number;
};
export const runPost = async ({
  docClient,
  table,
  job,
  acquired,
  jobStatus,
  runId,
  ttl,
}: runPostParam): Promise<void> => {
  try {
    if (acquired && jobStatus === 'success') {
      await putSuccessState({ docClient, table, job, ttl });
    }
  } finally {
    for (const heldStatus of ['running', 'claimed'] as const) {
      await releaseHeldState({ docClient, table, job, runId, heldStatus });
    }
  }
};

const putSuccessState = async ({
  docClient,
  table,
  job,
  ttl,
}: Pick<runPostParam, 'docClient' | 'table' | 'job' | 'ttl'>) => {
  const item: StateItem = {
    ...stateKey(job, 'success'),
    appPath: job.context.app_path,
    jobKey: job.context.job_key,
    jobStatus: 'success',
    commitTs: job.context.last_commit.timestamp,
    commitHash: job.context.last_commit.hash,
    ttl,
  };
  try {
    await docClient.send(
      new PutCommand({
        TableName: table,
        Item: item,
        ConditionExpression:
          'attribute_not_exists(commitTs) OR commitTs < :newCommitTs',
        ExpressionAttributeValues: {
          ':newCommitTs': job.context.last_commit.timestamp,
        },
      }),
    );
  } catch (err) {
    if (!isConditionalCheckFailed(err)) {
      throw err;
    }
    notice(
      `${job.context.label}: A newer or the same commit is already in success state`,
    );
  }
};

const releaseHeldState = async ({
  docClient,
  table,
  job,
  runId,
  heldStatus,
}: Pick<runPostParam, 'docClient' | 'table' | 'job' | 'runId'> & {
  heldStatus: HeldStatus;
}) => {
  try {
    const released = await releaseState({
      docClient,
      table,
      job,
      jobStatus: heldStatus,
      runId,
    });
    if (!released) {
      notice(
        `${job.context.label}: Left the ${heldStatus} state in place because this run does not hold it`,
      );
    }
  } catch (err) {
    console.error(`Failed to delete ${heldStatus} state: ${err}`);
  }
};
