import { notice } from '@actions/core';
import {
  DeleteCommand,
  type DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  isConditionalCheckFailed,
  StateItem,
  stateKey,
} from '@monotonix/dynamodb-common';
import { Job } from '@monotonix/schema';

type runPostParam = {
  docClient: DynamoDBDocumentClient;
  table: string;
  job: Job;
  jobStatus: 'success' | 'failure' | 'cancelled';
  runId: string;
  ttl: number;
};
export const runPost = async ({
  docClient,
  table,
  job,
  jobStatus,
  runId,
  ttl,
}: runPostParam): Promise<void> => {
  try {
    if (jobStatus === 'success') {
      await putSuccessState({ job, table, docClient, ttl });
    }
  } catch (err) {
    if (isConditionalCheckFailed(err)) {
      notice(
        `${job.context.label}: A newer or the same commit is already in success state`,
      );
      // No need to let it fail
    } else {
      throw err;
    }
  } finally {
    try {
      await deleteRunningState({ job, table, docClient, runId });
    } catch (err) {
      if (isConditionalCheckFailed(err)) {
        notice(
          `${job.context.label}: The running state is held by another run now`,
        );
        // No need to let it fail
      } else {
        console.error(`Failed to delete running state: ${err}`);
      }
    }
  }
};

const putSuccessState = async ({
  job,
  table,
  docClient,
  ttl,
}: {
  job: Job;
  table: string;
  docClient: DynamoDBDocumentClient;
  ttl: number;
}) => {
  const item: StateItem = {
    ...stateKey(job, 'success'),
    appPath: job.context.app_path,
    jobKey: job.context.job_key,
    jobStatus: 'success',
    commitTs: job.context.last_commit.timestamp,
    commitHash: job.context.last_commit.hash,
    ttl,
  };
  return docClient.send(
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
};

const deleteRunningState = async ({
  job,
  table,
  docClient,
  runId,
}: {
  job: Job;
  table: string;
  docClient: DynamoDBDocumentClient;
  runId: string;
}) => {
  return docClient.send(
    new DeleteCommand({
      TableName: table,
      Key: stateKey(job, 'running'),
      ConditionExpression: 'runId = :runId',
      ExpressionAttributeValues: {
        ':runId': runId,
      },
    }),
  );
};
