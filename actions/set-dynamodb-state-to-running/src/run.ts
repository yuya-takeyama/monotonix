import { Job } from '@monotonix/schema';
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { warning } from '@actions/core';
import { saveAwsCredentialsIntoState } from './utils';
import { StateItem } from '@monotonix/dynamodb-common';

type runParam = {
  job: Job;
  table: string;
  region: string;
  ttl: number;
};
export const run = async ({
  table,
  region,
  job,
  ttl,
}: runParam): Promise<void> => {
  saveAwsCredentialsIntoState();

  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);
  const pk = `STATE#${job.context.dedupe_key}`;

  try {
    await putRunningState({ job, table, docClient, pk, ttl });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      warning(
        `${job.context.label}: A job is already running for a newer commit`,
      );
    }
    throw err; // Let it fail not to run subsequent steps
  }
};

const putRunningState = async ({
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
  const jobStatus = 'running';
  const item: StateItem = {
    pk,
    sk: `${job.context.app_path}#${job.context.job_key}#${jobStatus}`,
    appPath: job.context.app_path,
    jobKey: job.context.job_key,
    jobStatus: jobStatus,
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
