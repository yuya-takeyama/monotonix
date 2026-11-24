import { notice } from '@actions/core';
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
export const run = async (
  params: runParam,
): Promise<'acquired' | 'superseded'> => {
  const { job } = params;
  const claim = await claimRunningState({ ...params, phase: 'started' });
  if (claim.claimed) {
    return 'acquired';
  }

  const { holder } = claim;
  const holderIsNewer =
    holder.commitTs !== undefined &&
    holder.commitTs > job.context.last_commit.timestamp;
  const heldBy = `Run ${holder.runId ?? '(unknown)'} holds the running state for commit ${holder.commitHash ?? '(unknown)'}`;

  // An older commit may still start while a newer commit is only claimed by
  // its setup job. Only a newer commit that has started stops it.
  if (holderIsNewer && holder.phase === 'claimed') {
    notice(
      `${job.context.label}: ${heldBy}, which has not started yet. Running this older commit without holding the running state.`,
    );
    return 'superseded';
  }

  throw new Error(
    holderIsNewer
      ? `${job.context.label}: ${heldBy}. A newer commit is already running.`
      : `${job.context.label}: ${heldBy}. Another run claimed the same commit, for example after this run's claim expired.`,
  );
};
