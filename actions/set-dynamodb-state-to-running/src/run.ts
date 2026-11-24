import { type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { claimRunningState } from '@monotonix/dynamodb-common';
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
  const claim = await claimRunningState(params);
  if (!claim.claimed) {
    throw new Error(
      `${params.job.context.label}: Run ${claim.holder.runId ?? '(unknown)'} holds the running state for commit ${claim.holder.commitHash ?? '(unknown)'}. A newer commit took it over, or this run's claim expired before this job started.`,
    );
  }
};
