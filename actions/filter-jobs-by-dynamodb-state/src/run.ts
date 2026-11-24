import { info, warning } from '@actions/core';
import {
  type DynamoDBDocumentClient,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  acquireState,
  type StateItem,
  StateItemSchema,
} from '@monotonix/dynamodb-common';
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
      ConsistentRead: true,
      KeyConditionExpression: 'pk = :pk',
      ExpressionAttributeValues: {
        ':pk': `STATE#${firstJob.context.dedupe_key}`,
      },
    }),
  );
  const { successTimestamps, runningStates } = toStates(res.Items ?? []);

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
    const running = runningStates.get(
      `${job.context.app_path}#${job.context.job_key}`,
    );
    if (
      running &&
      running.runId !== runId &&
      running.ttl >= now &&
      running.commitTs >= job.context.last_commit.timestamp
    ) {
      info(
        `${job.context.label}: ${job.context.last_commit.hash}: Skip: Job is already running in run ${running.runId ?? '(unknown)'} for commit ${running.commitHash}`,
      );
      return false;
    }
    return true;
  });

  const claimedJobs = await Promise.all(
    unfinishedJobs.map(async job => {
      const claim = await acquireState({
        docClient,
        table,
        job,
        jobStatus: 'claimed',
        runId,
        now,
        ttlSeconds,
      });
      if (!claim.acquired) {
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

type RunningState = Pick<
  StateItem,
  'commitTs' | 'commitHash' | 'runId' | 'ttl'
>;

const toStates = (items: unknown[]) => {
  const successTimestamps = new Map<string, number>();
  const runningStates = new Map<string, RunningState>();

  for (const item of items) {
    const result = StateItemSchema.safeParse(item);
    if (!result.success) {
      warning(
        `Failed to parse state item: ${result.error}: ${JSON.stringify(item)}`,
      );
      continue;
    }
    const key = `${result.data.appPath}#${result.data.jobKey}`;
    if (result.data.jobStatus === 'success') {
      successTimestamps.set(key, result.data.commitTs);
    }
    if (result.data.jobStatus === 'running') {
      runningStates.set(key, result.data);
    }
  }

  return { successTimestamps, runningStates };
};
