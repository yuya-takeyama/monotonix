import { randomUUID } from 'node:crypto';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import type { Job } from '@monotonix/schema';
import { type StateItem, StateItemSchema, stateKey } from './index.js';

// Integration tests run only when this points at a DynamoDB, e.g. DynamoDB Local.
export const testEndpoint = process.env.MONOTONIX_DYNAMODB_ENDPOINT;

export const createTestTable = async () => {
  const client = new DynamoDBClient({
    region: 'us-east-1',
    endpoint: testEndpoint,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  const table = `monotonix-test-${randomUUID()}`;
  await client.send(
    new CreateTableCommand({
      TableName: table,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
  const docClient = DynamoDBDocumentClient.from(client);
  return {
    docClient,
    table,
    getState: async (job: Job, jobStatus: StateItem['jobStatus']) => {
      const res = await docClient.send(
        new GetCommand({ TableName: table, Key: stateKey(job, jobStatus) }),
      );
      return res.Item ? StateItemSchema.parse(res.Item) : undefined;
    },
    drop: async () => {
      await client.send(new DeleteTableCommand({ TableName: table }));
      client.destroy();
    },
  };
};

export const buildJob = ({
  dedupeKey = 'refs/heads/main',
  jobKey = 'build_prd',
  commitTs = 1764000000,
  commitHash = 'c0ffee0',
}: {
  dedupeKey?: string;
  jobKey?: string;
  commitTs?: number;
  commitHash?: string;
} = {}): Job => ({
  app: { depends_on: [], metadata: {} },
  context: {
    dedupe_key: dedupeKey,
    github_ref: 'refs/heads/main',
    app_path: 'apps/web',
    root_dir: 'apps',
    last_commit: { hash: commitHash, timestamp: commitTs },
    job_key: jobKey,
    label: `apps/web / ${jobKey}`,
  },
  on: { push: { branches: ['main'] } },
  configs: {},
  params: {},
  metadata: {},
});
