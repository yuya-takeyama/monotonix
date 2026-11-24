import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { claimRunningState, getRunId, stateKey } from './index';
import { buildJob, createTestTable, testEndpoint } from './testing';

describe('getRunId', () => {
  test('returns GITHUB_RUN_ID', () => {
    expect(getRunId({ GITHUB_RUN_ID: '12345' })).toBe('12345');
  });

  test('throws when GITHUB_RUN_ID is missing', () => {
    expect(() => getRunId({})).toThrow(/GITHUB_RUN_ID/);
  });
});

describe.skipIf(!testEndpoint)('claimRunningState', () => {
  const now = 1_800_000_000;
  const ttlSeconds = 3600;
  const job = buildJob({ commitTs: 1_700_000_000, commitHash: 'aaa' });
  let db: Awaited<ReturnType<typeof createTestTable>>;

  beforeEach(async () => {
    db = await createTestTable();
  });

  afterEach(async () => {
    await db.drop();
  });

  const claim = (
    runId: string,
    overrides: Partial<Parameters<typeof claimRunningState>[0]> = {},
  ) =>
    claimRunningState({
      docClient: db.docClient,
      table: db.table,
      job,
      runId,
      now,
      ttlSeconds,
      phase: 'claimed',
      ...overrides,
    });

  test('claims a job nobody holds', async () => {
    expect(await claim('run-a')).toEqual({ claimed: true });
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-a',
      commitTs: 1_700_000_000,
      commitHash: 'aaa',
      phase: 'claimed',
      ttl: now + ttlSeconds,
    });
  });

  test('refuses a claim another run holds for the same commit', async () => {
    await claim('run-a');

    expect(await claim('run-b')).toEqual({
      claimed: false,
      holder: {
        runId: 'run-a',
        commitHash: 'aaa',
        commitTs: 1_700_000_000,
        phase: 'claimed',
      },
    });
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-a',
    });
  });

  test('accepts a claim the same run already holds', async () => {
    await claim('run-a');

    expect(await claim('run-a', { now: now + 60, phase: 'started' })).toEqual({
      claimed: true,
    });
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-a',
      phase: 'started',
      ttl: now + 60 + ttlSeconds,
    });
  });

  test('takes over a claim held for an older commit', async () => {
    await claim('run-a');
    const newerJob = buildJob({ commitTs: 1_700_000_100, commitHash: 'bbb' });

    expect(await claim('run-b', { job: newerJob })).toEqual({ claimed: true });
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-b',
      commitHash: 'bbb',
    });
  });

  test('refuses a claim when a newer commit holds it', async () => {
    const newerJob = buildJob({ commitTs: 1_700_000_100, commitHash: 'bbb' });
    await claim('run-b', { job: newerJob });

    expect(await claim('run-a')).toEqual({
      claimed: false,
      holder: {
        runId: 'run-b',
        commitHash: 'bbb',
        commitTs: 1_700_000_100,
        phase: 'claimed',
      },
    });
  });

  test('takes over an expired claim that DynamoDB TTL has not deleted yet', async () => {
    await claim('run-a', { now: now - ttlSeconds - 1 });

    expect(await claim('run-b')).toEqual({ claimed: true });
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-b',
    });
  });

  test('refuses a claim held by a running state without runId', async () => {
    await db.docClient.send(
      new PutCommand({
        TableName: db.table,
        Item: {
          ...stateKey(job, 'running'),
          appPath: job.context.app_path,
          jobKey: job.context.job_key,
          jobStatus: 'running',
          commitTs: job.context.last_commit.timestamp,
          commitHash: 'aaa',
          ttl: now + ttlSeconds,
        },
      }),
    );

    expect(await claim('run-b')).toEqual({
      claimed: false,
      holder: {
        runId: undefined,
        commitHash: 'aaa',
        commitTs: 1_700_000_000,
        phase: undefined,
      },
    });
  });

  test('rethrows errors other than a failed condition', async () => {
    await expect(
      claim('run-a', { table: `${db.table}-missing` }),
    ).rejects.toMatchObject({ name: 'ResourceNotFoundException' });
  });
});
