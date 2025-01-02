import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';

async function main() {
  const client = new DynamoDBClient({ region: 'ap-northeast-1' });
  const docClient = DynamoDBDocumentClient.from(client);

  const table = 'monotonix-state';
  const workflowId = 'docker_build';
  const githubRef = 'refs/heads/main';
  const job = {
    context: {
      app_path: '/apps/hello-world',
      job_key: 'job1',
      last_commit: {
        hash: '0000000000',
        timestamp: 0,
      },
    },
  };
  const putItems = [
    {
      PutRequest: {
        Item: {
          pk: `STATE#${workflowId}#${githubRef}`,
          sk: `${job.context.app_path}#${job.context.job_key}#running`,
          appPath: job.context.app_path,
          jobKey: job.context.job_key,
          jobStatus: 'running',
          commitTs: job.context.last_commit.timestamp,
          commitHash: job.context.last_commit.hash,
          ttl: Math.floor(Date.now() / 1000) + 60 * 60,
        },
      },
    },
  ];

  const params = {
    RequestItems: {
      [table]: putItems,
    },
  };

  await docClient.send(new BatchWriteCommand(params));
}

main();
