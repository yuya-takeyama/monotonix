import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  acquireState,
  getRunId,
  type HeldStatus,
  releaseState,
  stateKey,
} from './index';
import { buildJob, createTestTable, testEndpoint } from './testing';

describe('getRunId', () => {
  test('returns GITHUB_RUN_ID', () => {
    expect(getRunId({ GITHUB_RUN_ID: '12345' })).toBe('12345');
  });

  test('throws when GITHUB_RUN_ID is missing', () => {
    expect(() => getRunId({})).toThrow(/GITHUB_RUN_ID/);
  });
});

describe.skipIf(!testEndpoint)('acquireState and releaseState', () => {
  const now = 1_800_000_000;
  const ttlSeconds = 3600;
  const job = buildJob({ commitTs: 1_700_000_000, commitHash: 'aaa' });
  const olderJob = buildJob({ commitTs: 1_699_999_900, commitHash: 'old' });
  const newerJob = buildJob({ commitTs: 1_700_000_100, commitHash: 'bbb' });
  let db: Awaited<ReturnType<typeof createTestTable>>;

  beforeEach(async () => {
    db = await createTestTable();
  });

  afterEach(async () => {
    await db.drop();
  });

  const acquire = (
    runId: string,
    overrides: Partial<Parameters<typeof acquireState>[0]> = {},
  ) =>
    acquireState({
      docClient: db.docClient,
      table: db.table,
      job,
      jobStatus: 'claimed',
      runId,
      now,
      ttlSeconds,
      ...overrides,
    });

  const release = (runId: string, jobStatus: HeldStatus = 'claimed') =>
    releaseState({
      docClient: db.docClient,
      table: db.table,
      job,
      jobStatus,
      runId,
    });

  const putItemWithoutRunId = (commitTs: number, commitHash: string) =>
    db.docClient.send(
      new PutCommand({
        TableName: db.table,
        Item: {
          ...stateKey(job, 'running'),
          appPath: job.context.app_path,
          jobKey: job.context.job_key,
          jobStatus: 'running',
          commitTs,
          commitHash,
          ttl: now + ttlSeconds,
        },
      }),
    );

  test('acquires an item nobody holds', async () => {
    expect(await acquire('run-a')).toEqual({ acquired: true });
    expect(await db.getState(job, 'claimed')).toEqual({
      ...stateKey(job, 'claimed'),
      appPath: 'apps/web',
      jobKey: 'build_prd',
      jobStatus: 'claimed',
      commitTs: 1_700_000_000,
      commitHash: 'aaa',
      runId: 'run-a',
      ttl: now + ttlSeconds,
    });
  });

  test('refuses an item another run holds for the same commit', async () => {
    await acquire('run-a');

    expect(await acquire('run-b')).toEqual({
      acquired: false,
      holder: { runId: 'run-a', commitHash: 'aaa', commitTs: 1_700_000_000 },
    });
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-a',
    });
  });

  test('acquires an item the same run already holds and extends its ttl', async () => {
    await acquire('run-a');

    expect(await acquire('run-a', { now: now + 60 })).toEqual({
      acquired: true,
    });
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-a',
      ttl: now + 60 + ttlSeconds,
    });
  });

  test('takes over an item held for an older commit', async () => {
    await acquire('run-a');

    expect(await acquire('run-b', { job: newerJob })).toEqual({
      acquired: true,
    });
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-b',
      commitHash: 'bbb',
    });
  });

  test('refuses an item held for a newer commit', async () => {
    await acquire('run-b', { job: newerJob });

    expect(await acquire('run-a')).toEqual({
      acquired: false,
      holder: { runId: 'run-b', commitHash: 'bbb', commitTs: 1_700_000_100 },
    });
  });

  test('takes over an expired item held for the same commit that DynamoDB TTL has not deleted yet', async () => {
    await acquire('run-a', { now: now - ttlSeconds - 1 });

    expect(await acquire('run-b')).toEqual({ acquired: true });
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-b',
    });
  });

  test('refuses an expired item held for a newer commit', async () => {
    await acquire('run-b', { job: newerJob, now: now - ttlSeconds - 1 });

    expect(await acquire('run-a')).toMatchObject({ acquired: false });
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-b',
    });
  });

  test('refuses an item without runId held for the same commit', async () => {
    await putItemWithoutRunId(1_700_000_000, 'aaa');

    expect(await acquire('run-b', { jobStatus: 'running' })).toEqual({
      acquired: false,
      holder: { runId: undefined, commitHash: 'aaa', commitTs: 1_700_000_000 },
    });
  });

  test('takes over an item without runId held for an older commit', async () => {
    await putItemWithoutRunId(olderJob.context.last_commit.timestamp, 'old');

    expect(await acquire('run-b', { jobStatus: 'running' })).toEqual({
      acquired: true,
    });
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-b',
      commitHash: 'aaa',
    });
  });

  test('keeps the claimed and running items of a job apart', async () => {
    await acquire('run-a', { jobStatus: 'claimed' });

    expect(await acquire('run-b', { jobStatus: 'running' })).toEqual({
      acquired: true,
    });
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-a',
    });
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-b',
    });
  });

  test('rethrows errors other than a failed condition', async () => {
    await expect(
      acquire('run-a', { table: `${db.table}-missing` }),
    ).rejects.toMatchObject({ name: 'ResourceNotFoundException' });
  });

  test('releases an item this run holds', async () => {
    await acquire('run-a');

    expect(await release('run-a')).toBe(true);
    expect(await db.getState(job, 'claimed')).toBeUndefined();
  });

  test('leaves an item another run holds', async () => {
    await acquire('run-a');

    expect(await release('run-b')).toBe(false);
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-a',
    });
  });

  test('reports an item that is already gone as not released', async () => {
    expect(await release('run-a')).toBe(false);
  });
});
