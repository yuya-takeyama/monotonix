import { Job, Jobs } from '@monotonix/schema';
import {
  DynamoDBClient,
  BatchWriteItemCommandInput,
  BatchWriteItemCommand,
  WriteRequest,
} from '@aws-sdk/client-dynamodb';

type runParam = {
  jobs: Jobs;
  table: string;
  region: string;
  status: 'running' | 'success' | 'failure';
  ttl?: number | null;
};
export const run = async ({
  jobs,
  table,
  region,
  status,
  ttl,
}: runParam): Promise<void> => {
  const client = new DynamoDBClient({ region });
  const chunkedJobs = chunkArray(25, jobs);

  const ttlKey: { ttl: { N: string } } | {} =
    typeof ttl === 'number' ? { ttl: { N: ttl.toString() } } : {};

  for (const chunk of chunkedJobs) {
    const writeRequests: WriteRequest[] = chunk.map(job => ({
      PutRequest: {
        Item: {
          pk: { S: JSON.stringify(job.keys) },
          sk: { N: job.context.last_commit.timestamp.toString() },
          // "status" is a reserved word in DynamoDB
          // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html
          jobStatus: { S: status },
          commitHash: { S: job.context.last_commit.hash },
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
