import { info, warning } from '@actions/core';
import {
  type DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { claimRunningState, StateItemSchema } from '@monotonix/dynamodb-common';
import { Jobs } from '@monotonix/schema';

type runParam = {
  docClient: DynamoDBDocumentClient;
  table: string;
  jobs: Jobs;
  runId: string;
  now: number;
  ttlSeconds: number;
};
export const run = async ({
  docClient,
  table,
  jobs,
  runId,
  now,
  ttlSeconds,
}: runParam): Promise<Jobs> => {
  const firstJob = jobs[0];

  if (!firstJob) {
    return jobs;
  }

  const res = await docClient.send(
    new QueryCommand({
      TableName: table,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `STATE#${firstJob.context.dedupe_key}`,
      },
    }),
  );
  const successTimestamps = toSuccessTimestamps(res.Items ?? []);

  const unfinishedJobs = jobs.filter(job => {
    const successTs = successTimestamps.get(
      `${job.context.app_path}#${job.context.job_key}`,
    );
    if (
      successTs !== undefined &&
      successTs >= job.context.last_commit.timestamp
    ) {
      info(
        `${job.context.label}: ${job.context.last_commit.hash}: Skip: Job is already in success state`,
      );
      return false;
    }
    return true;
  });

  const claimedJobs = await Promise.all(
    unfinishedJobs.map(async job => {
      const claim = await claimRunningState({
        docClient,
        table,
        job,
        runId,
        now,
        ttlSeconds,
        phase: 'claimed',
      });
      if (!claim.claimed) {
        info(
          `${job.context.label}: ${job.context.last_commit.hash}: Skip: Job is already claimed by run ${claim.holder.runId ?? '(unknown)'} for commit ${claim.holder.commitHash ?? '(unknown)'}`,
        );
        return undefined;
      }
      return job;
    }),
  );

  return claimedJobs.filter(job => job !== undefined);
};

const toSuccessTimestamps = (items: unknown[]): Map<string, number> => {
  const successTimestamps = new Map<string, number>();

  for (const item of items) {
    const result = StateItemSchema.safeParse(item);
    if (!result.success) {
      warning(
        `Failed to parse state item: ${result.error}: ${JSON.stringify(item)}`,
      );
      continue;
    }
    if (result.data.jobStatus === 'success') {
      successTimestamps.set(
        `${result.data.appPath}#${result.data.jobKey}`,
        result.data.commitTs,
      );
    }
  }

  return successTimestamps;
};
