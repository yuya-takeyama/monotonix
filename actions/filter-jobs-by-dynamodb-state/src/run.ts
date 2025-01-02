import { Jobs } from '@monotonix/schema';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { info, warning } from '@actions/core';
import { z } from 'zod';

type runParam = {
  workflowId: string;
  githubRef: string;
  jobs: Jobs;
  table: string;
  region: string;
};
export const run = async ({
  workflowId,
  githubRef,
  jobs,
  table,
  region,
}: runParam): Promise<Jobs> => {
  const client = new DynamoDBClient({ region });
  const docClient = DynamoDBDocumentClient.from(client);

  const filteredJobs = await filterJobs({
    docClient,
    workflowId,
    githubRef,
    jobs,
    table,
  });

  await setRunningStatus({
    docClient,
    table,
    jobs: filteredJobs,
    workflowId,
    githubRef,
  });

  return jobs;
};

const setRunningStatus = async ({
  docClient,
  table,
  jobs,
  workflowId,
  githubRef,
}: {
  docClient: DynamoDBDocumentClient;
  table: string;
  jobs: Jobs;
  workflowId: string;
  githubRef: string;
}) => {
  const chunkedJobs = partitionArray(25, jobs);

  for (const jobs of chunkedJobs) {
    const putItems = jobs.map(job => ({
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
    }));

    const params = {
      RequestItems: {
        [table]: putItems,
      },
    };

    await docClient.send(new BatchWriteCommand(params));
  }
};

const partitionArray = <T>(chunkSize: number, array: T[]): T[][] => {
  const result = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    result.push(array.slice(i, i + chunkSize));
  }
  return result;
};

type filterJobsParams = {
  docClient: DynamoDBDocumentClient;
  table: string;
  workflowId: string;
  githubRef: string;
  jobs: Jobs;
};
const filterJobs = async ({
  docClient,
  table,
  workflowId,
  githubRef,
  jobs,
}: filterJobsParams) => {
  const res = await docClient.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `STATE#${workflowId}#${githubRef}`,
      },
    }),
  );

  if (res.Items && res.Items.length > 0) {
    return filterJobsByAppJobStatuses(jobs, transofrmItems(res.Items));
  } else {
    return jobs;
  }
};

const filterJobsByAppJobStatuses = (
  jobs: Jobs,
  appJobStatuses: AppJobStatuses,
) => {
  return jobs.filter(job => {
    const appJobStatus =
      appJobStatuses[`${job.context.app_path}#${job.context.job_key}`];
    if (appJobStatus) {
      if (
        appJobStatus.successTs &&
        appJobStatus.successTs >= job.context.last_commit.timestamp
      ) {
        info(
          `Skip: Job is already success: ${job.context.label}: ${job.context.last_commit.hash}`,
        );
        return false;
      }
      if (
        appJobStatus.runningTs &&
        appJobStatus.runningTs >= job.context.last_commit.timestamp
      ) {
        info(
          `Skip: Job is already running: ${job.context.label}: ${job.context.last_commit.hash}`,
        );
        return false;
      }
    }
    return true;
  });
};

const StateItemSchema = z.object({
  appPath: z.object({ S: z.string() }),
  jobKey: z.object({ S: z.string() }),
  jobStatus: z.object({ S: z.enum(['running', 'success']) }),
  commitTs: z.object({ N: z.string() }),
  commitHash: z.object({ S: z.string() }),
});

type StateItem = z.infer<typeof StateItemSchema>;

const AppJobStatus = z.object({
  appPath: z.string(),
  jobKey: z.string(),
  runningTs: z.number().optional(),
  successTs: z.number().optional(),
});

const AppJobStatusesSchema = z.record(z.string(), AppJobStatus);
type AppJobStatuses = z.infer<typeof AppJobStatusesSchema>;

const transofrmItems = (items: Record<string, any>[]) => {
  const appJobStatuses: AppJobStatuses = {};

  for (const item of items) {
    let stateItem: StateItem | null = null;
    const result = StateItemSchema.safeParse(item);
    if (result.success) {
      stateItem = result.data;
      const appJobStatus =
        appJobStatuses[`${stateItem.appPath}#${stateItem.jobKey}`];
      if (!appJobStatus) {
        appJobStatuses[`${stateItem.appPath}#${stateItem.jobKey}`] = {
          appPath: stateItem.appPath.S,
          jobKey: stateItem.jobKey.S,
          [`${stateItem.jobStatus.S}Ts`]: Number(stateItem.commitTs.N),
        };
      } else {
        appJobStatuses[`${stateItem.appPath}#${stateItem.jobKey}`] = {
          ...appJobStatus,
          [`${stateItem.jobStatus.S}Ts`]: Number(stateItem.commitTs.N),
        };
      }
    } else {
      warning(
        `Failed to parse state item: ${result.error}: ${JSON.stringify(item)}`,
      );
    }
  }

  return appJobStatuses;
};
