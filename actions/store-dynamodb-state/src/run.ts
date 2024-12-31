import { JobParam, JobParamSchema } from '@monotonix/schema';
import {
  DynamoDBClient,
  BatchWriteItemCommandInput,
  BatchWriteItemCommand,
  WriteRequest,
} from '@aws-sdk/client-dynamodb';
import { z } from 'zod';

type runParam = {
  jobParams: string;
  table: string;
  region: string;
  status: 'running' | 'success' | 'failure';
  ttl?: number | null;
};
export const run = async ({
  jobParams,
  table,
  region,
  status,
  ttl,
}: runParam): Promise<void> => {
  const client = new DynamoDBClient({ region });
  const chunkedJobParams = chunkArray(25, parseJobParams(jobParams));

  const ttlKey: { ttl: { N: string } } | {} =
    typeof ttl === 'number' ? { ttl: { N: ttl.toString() } } : {};

  for (const chunk of chunkedJobParams) {
    const writeRequests: WriteRequest[] = chunk.map(jobParam => ({
      PutRequest: {
        Item: {
          pk: { S: JSON.stringify(jobParam.keys) },
          sk: { N: jobParam.app_context.last_commit.timestamp.toString() },
          // "status" is a reserved word in DynamoDB
          // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html
          jobStatus: { S: status },
          commitHash: { S: jobParam.app_context.last_commit.hash },
          ...ttlKey,
        },
      },
    }));
    const params: BatchWriteItemCommandInput = {
      RequestItems: {
        [table]: writeRequests,
      },
    };

    await client.send(new BatchWriteItemCommand(params));
  }
};

const chunkArray = <T>(chunkSize: number, array: T[]): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
};

const parseJobParams = (jobParams: string): JobParam[] => {
  if (isArrayJson(jobParams)) {
    return z.array(JobParamSchema).parse(JSON.parse(jobParams));
  } else {
    return [JobParamSchema.parse(JSON.parse(jobParams))];
  }
};

const isArrayJson = (value: string): boolean => {
  return value.trim().startsWith('[');
};
