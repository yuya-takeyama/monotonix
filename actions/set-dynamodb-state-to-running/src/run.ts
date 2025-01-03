import { Job } from '@monotonix/schema';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

type runParam = {
  workflowId: string;
  githubRef: string;
  job: Job;
  table: string;
  region: string;
  status: 'success' | 'failure' | 'cancelled';
  ttl?: number | null;
};
export const run = async ({
  workflowId,
  githubRef,
  job,
  table,
  region,
  status,
  ttl,
}: runParam): Promise<void> => {
  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);

  const pk = `STATE#${workflowId}#${githubRef}`;

  if (status === 'success') {
    await putSuccessState({ job, table, docClient, pk, ttl });
  }
  await deleteRunningState({ job, table, docClient, pk });
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
  ttl?: number | null;
}) => {
  const ttlKey: { ttl: number } | {} = typeof ttl === 'number' ? { ttl } : {};
  return docClient.send(
    new PutCommand({
      TableName: table,
      Item: {
        pk,
        sk: `${job.context.app_path}#${job.context.job_key}#success`,
        appPath: job.context.app_path,
        jobKey: job.context.job_key,
        jobStatus: 'success',
        commitTs: job.context.last_commit.timestamp,
        commitHash: job.context.last_commit.hash,
        ...ttlKey,
      },
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
