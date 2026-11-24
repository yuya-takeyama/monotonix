import { type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { acquireState } from '@monotonix/dynamodb-common';
import { Job } from '@monotonix/schema';

type runParam = {
  docClient: DynamoDBDocumentClient;
  table: string;
  job: Job;
  runId: string;
  now: number;
  ttlSeconds: number;
};
export const run = async (params: runParam): Promise<void> => {
  const { job } = params;
  const result = await acquireState({ ...params, jobStatus: 'running' });
  if (result.acquired) {
    return;
  }

  const { holder } = result;
  const reason =
    holder.commitTs !== undefined &&
    holder.commitTs > job.context.last_commit.timestamp
      ? 'A newer commit is already running.'
      : 'Another run is already running the same commit.';
  throw new Error(
    `${job.context.label}: Run ${holder.runId ?? '(unknown)'} holds the running state for commit ${holder.commitHash ?? '(unknown)'}. ${reason}`,
  );
};
