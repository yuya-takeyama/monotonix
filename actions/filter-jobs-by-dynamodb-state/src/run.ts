import { Jobs } from '@monotonix/schema';
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/client-dynamodb';
import { info } from '@actions/core';

type runParam = {
  jobs: Jobs;
  table: string;
  region: string;
};
export const run = async ({ jobs, table, region }: runParam): Promise<Jobs> => {
  const client = new DynamoDBClient({ region });

  const results = await Promise.all(
    jobs.map(async job => {
      const input: QueryCommandInput = {
        TableName: table,
        KeyConditionExpression: 'pk = :pk AND sk >= :sk',
        FilterExpression: 'jobStatus = :success OR jobStatus = :running',
        ExpressionAttributeValues: {
          ':pk': { S: JSON.stringify(job.keys) },
          ':sk': { N: job.context.last_commit.timestamp.toString() },
          ':success': { S: 'success' },
          ':running': { S: 'running' },
        },
        ProjectionExpression: 'pk, sk, jobStatus',
      };
      const result = await client.send(new QueryCommand(input));
      if (typeof result.Count === 'number' && result.Count > 0) {
        info(
          `Skip: Job is already running or success: ${job.context.label}: ${job.context.last_commit.hash}`,
        );

        return null;
      }

      return job;
    }),
  );

  return results.filter(result => !!result);
};
