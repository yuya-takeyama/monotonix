import { notice } from '@actions/core';
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { StateItem } from '@monotonix/dynamodb-common';
import { Job } from '@monotonix/schema';
import { saveAwsCredentialsIntoState, saveRunningStateClaimed } from './utils';

type runParam = {
  job: Job;
  table: string;
  region: string;
  ttl: number;
  docClient?: DynamoDBDocumentClient;
};
type RunResult = {
  shouldRun: boolean;
};
export const run = async ({
  table,
  region,
  job,
  ttl,
  docClient,
}: runParam): Promise<RunResult> => {
  saveAwsCredentialsIntoState();

  const dynamoDbDocClient =
    docClient ?? DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
  const pk = `STATE#${job.context.dedupe_key}`;

  try {
    await putRunningState({
      job,
      table,
      docClient: dynamoDbDocClient,
      pk,
      ttl,
    });
    saveRunningStateClaimed();
    return { shouldRun: true };
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      notice(
        `${job.context.label}: A job is already running for a newer commit`,
      );
      return { shouldRun: false };
    }
    throw err;
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
