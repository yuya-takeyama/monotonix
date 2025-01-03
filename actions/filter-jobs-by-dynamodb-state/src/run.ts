import { Jobs } from '@monotonix/schema';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { info, warning } from '@actions/core';
import { z } from 'zod';
import { StateItemSchema, StateItem } from '@monotonix/dynamodb-common';

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

  return filteredJobs;
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

const AppJobStatusSchema = z.object({
  appPath: z.string(),
  jobKey: z.string(),
  runningTs: z.number().optional(),
  successTs: z.number().optional(),
});

const AppJobStatusesSchema = z.record(z.string(), AppJobStatusSchema);
type AppJobStatuses = z.infer<typeof AppJobStatusesSchema>;

const transofrmItems = (items: Record<string, any>[]): AppJobStatuses => {
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
          appPath: stateItem.appPath,
          jobKey: stateItem.jobKey,
          [`${stateItem.jobStatus}Ts`]: stateItem.commitTs,
        };
      } else {
        appJobStatuses[`${stateItem.appPath}#${stateItem.jobKey}`] = {
          ...appJobStatus,
          [`${stateItem.jobStatus}Ts`]: stateItem.commitTs,
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
