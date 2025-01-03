import { Job } from '@monotonix/schema';
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { notice } from '@actions/core';
import { StateItem } from '@monotonix/dynamodb-common';

type runPostParam = {
  job: Job;
  jobStatus: 'success' | 'failure' | 'cancelled';
  table: string;
  region: string;
  ttl: number;
};
export const runPost = async ({
  table,
  region,
  job,
  jobStatus,
  ttl,
}: runPostParam): Promise<void> => {
  console.log('DEBUG: runPost');
  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);

  const pk = `STATE#${job.context.workflow_id}#${job.context.github_ref}`;

  console.log('DEBUG: putRunningState');
  try {
    if (jobStatus === 'success') {
      await putSuccessState({ job, table, docClient, pk, ttl });
    }
    console.log('DEBUG: putRunningState done');
  } catch (err) {
    console.log(`DEBUG: putRunningState error: ${err}`);
    if (err instanceof ConditionalCheckFailedException) {
      notice(
        `${job.context.label}: A newer commit is already set to state as success`,
      );
      // No need to let it fail
    } else {
      throw err;
    }
  } finally {
    try {
      console.log('DEBUG: deleteRunningState');
      await deleteRunningState({ job, table, docClient, pk });
      console.log('DEBUG: deleteRunningState done');
    } catch (err) {
      console.log(`DEBUG: deleteRunningState error: ${err}`);
      if (err instanceof ConditionalCheckFailedException) {
        notice(`${job.context.label}: A newer commit is already running`);
        // No need to let it fail
      } else {
        throw err;
      }
    }
  }
};

const putSuccessState = async ({
  job,
  table,
  docClient,
  pk,
  ttl,
}: {
  job: Job;
  table: string;
  docClient: DynamoDBDocumentClient;
  pk: string;
  ttl: number;
}) => {
  const item: StateItem = {
    pk,
    sk: `${job.context.app_path}#${job.context.job_key}#success`,
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
  pk,
}: {
  job: Job;
  table: string;
  docClient: DynamoDBDocumentClient;
  pk: string;
}) => {
  return docClient.send(
    new DeleteCommand({
      TableName: table,
      Key: {
        pk,
        sk: `${job.context.app_path}#${job.context.job_key}#running`,
      },
      ConditionExpression: 'commitTs = :commitTs',
      ExpressionAttributeValues: {
        ':commitTs': job.context.last_commit.timestamp,
      },
    }),
  );
};
