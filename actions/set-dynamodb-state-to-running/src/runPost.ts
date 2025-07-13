import { notice } from '@actions/core';
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { StateItem } from '@monotonix/dynamodb-common';
import { Job } from '@monotonix/schema';

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
  const client = new DynamoDBClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.AWS_SESSION_TOKEN!,
    },
  });
  const docClient = DynamoDBDocumentClient.from(client);
  const pk = `STATE#${job.context.dedupe_key}`;

  try {
    if (jobStatus === 'success') {
      await putSuccessState({ job, table, docClient, pk, ttl });
    }
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      notice(
        `${job.context.label}: A newer or the same commit is already in success state`,
      );
      // No need to let it fail
    } else {
      throw err;
    }
  } finally {
    try {
      await deleteRunningState({ job, table, docClient, pk });
    } catch (err) {
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
