import { JobParam, JobParamSchema } from '@monotonix/schema';
import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/client-dynamodb';
import { z } from 'zod';
import { warning } from '@actions/core';

type runParam = {
  jobParams: string;
  table: string;
  region: string;
};
export const run = async ({
  jobParams,
  table,
  region,
}: runParam): Promise<JobParam[]> => {
  const client = new DynamoDBClient({ region });

  const results = await Promise.all(
    paraseJobParams(jobParams).map(async jobParam => {
      const input: QueryCommandInput = {
        TableName: table,
        KeyConditionExpression: 'pk = :pk AND sk >= :sk',
        FilterExpression: 'jobStatus = :success OR jobStatus = :running',
        ExpressionAttributeValues: {
          ':pk': { S: JSON.stringify(jobParam.keys) },
          ':sk': { N: jobParam.app_context.last_commit.timestamp.toString() },
          ':success': { S: 'success' },
          ':running': { S: 'running' },
        },
        ProjectionExpression: 'pk, sk, jobStatus',
      };
      const result = await client.send(new QueryCommand(input));
      if (typeof result.Count === 'number' && result.Count > 0) {
        warning(
          `Skip: Job is already running or success: ${JSON.stringify(jobParam.keys)}`,
        );

        return null;
      }

      return jobParam;
    }),
  );

  return results.filter(result => !!result);
};

const paraseJobParams = (jobParams: string): JobParam[] => {
  return z.array(JobParamSchema).parse(JSON.parse(jobParams));
};
