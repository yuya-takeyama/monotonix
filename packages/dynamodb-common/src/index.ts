import type { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { type DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Job } from '@monotonix/schema';
import { z } from 'zod';

export const StateItemSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  appPath: z.string(),
  jobKey: z.string(),
  jobStatus: z.enum(['running', 'success']),
  commitTs: z.number(),
  commitHash: z.string(),
  runId: z.string().optional(),
  ttl: z.number(),
});

export type StateItem = z.infer<typeof StateItemSchema>;

export const stateKey = (job: Job, jobStatus: StateItem['jobStatus']) => ({
  pk: `STATE#${job.context.dedupe_key}`,
  sk: `${job.context.app_path}#${job.context.job_key}#${jobStatus}`,
});

export const getRunId = (env: NodeJS.ProcessEnv = process.env): string => {
  const runId = env.GITHUB_RUN_ID;
  if (!runId) {
    throw new Error('env $GITHUB_RUN_ID is required');
  }
  return runId;
};

// Matched by name so a second bundled copy of the SDK cannot defeat instanceof.
export const isConditionalCheckFailed = (
  err: unknown,
): err is ConditionalCheckFailedException =>
  err instanceof Error && err.name === 'ConditionalCheckFailedException';

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; holder: { runId?: string; commitHash?: string } };

type ClaimRunningStateParams = {
  docClient: DynamoDBDocumentClient;
  table: string;
  job: Job;
  runId: string;
  now: number;
  ttlSeconds: number;
};

export const claimRunningState = async ({
  docClient,
  table,
  job,
  runId,
  now,
  ttlSeconds,
}: ClaimRunningStateParams): Promise<ClaimResult> => {
  const item: StateItem = {
    ...stateKey(job, 'running'),
    appPath: job.context.app_path,
    jobKey: job.context.job_key,
    jobStatus: 'running',
    commitTs: job.context.last_commit.timestamp,
    commitHash: job.context.last_commit.hash,
    runId,
    ttl: now + ttlSeconds,
  };
  try {
    await docClient.send(
      new PutCommand({
        TableName: table,
        Item: item,
        // DynamoDB TTL deletes expired items lazily, so an expired claim can
        // still be in the table and must not block anyone.
        ConditionExpression:
          'attribute_not_exists(commitTs) OR commitTs < :commitTs OR runId = :runId OR #ttl < :now',
        ExpressionAttributeNames: { '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':commitTs': item.commitTs,
          ':runId': runId,
          ':now': now,
        },
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD',
      }),
    );
    return { claimed: true };
  } catch (err) {
    if (!isConditionalCheckFailed(err)) {
      throw err;
    }
    return {
      claimed: false,
      holder: {
        runId: err.Item?.runId?.S,
        commitHash: err.Item?.commitHash?.S,
      },
    };
  }
};

export const parseDuration = (duration: string): number => {
  const regex = /(\d+)(\D+)/g;
  let matches: RegExpExecArray | null;
  let totalSeconds = 0;
  let lastIndex = 0;

  do {
    matches = regex.exec(duration);
    if (matches?.[1] && matches[2]) {
      const value = Number(matches[1]);
      const unit = matches[2];

      switch (unit) {
        case 'd':
          totalSeconds += value * 60 * 60 * 24;
          break;
        case 'h':
          totalSeconds += value * 60 * 60;
          break;
        case 'm':
          totalSeconds += value * 60;
          break;
        case 's':
          totalSeconds += value;
          break;
        default:
          throw new Error(`Invalid unit: ${unit}`);
      }
      lastIndex = regex.lastIndex;
    }
  } while (matches !== null);

  if (lastIndex !== duration.length) {
    throw new Error(`Invalid format: ${duration}`);
  }

  return totalSeconds;
};
