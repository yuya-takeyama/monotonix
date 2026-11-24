import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { stateKey } from '@monotonix/dynamodb-common';
import {
  buildJob,
  createTestTable,
  testEndpoint,
} from '@monotonix/dynamodb-common/testing';
import type { Job } from '@monotonix/schema';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { run } from './run';

describe.skipIf(!testEndpoint)('run', () => {
  const now = 1_800_000_000;
  let db: Awaited<ReturnType<typeof createTestTable>>;

  beforeEach(async () => {
    db = await createTestTable();
  });

  afterEach(async () => {
    await db.drop();
  });

  const filter = (runId: string, jobs: Job[]) =>
    run({
      docClient: db.docClient,
      table: db.table,
      jobs,
      runId,
      now,
      ttlSeconds: 3600,
    });

  const putSuccess = (job: Job, commitTs: number) =>
    db.docClient.send(
      new PutCommand({
        TableName: db.table,
        Item: {
          ...stateKey(job, 'success'),
          appPath: job.context.app_path,
          jobKey: job.context.job_key,
          jobStatus: 'success',
          commitTs,
          commitHash: 'old',
          ttl: now + 86400,
        },
      }),
    );

  const putRunning = (
    job: Job,
    item: { runId?: string; commitTs: number; ttl: number },
  ) =>
    db.docClient.send(
      new PutCommand({
        TableName: db.table,
        Item: {
          ...stateKey(job, 'running'),
          appPath: job.context.app_path,
          jobKey: job.context.job_key,
          jobStatus: 'running',
          commitHash: 'running-commit',
          ...item,
        },
      }),
    );

  test('keeps a job for only one of two runs filtering it at the same time', async () => {
    const job = buildJob();

    const [a, b] = await Promise.all([
      filter('run-a', [job]),
      filter('run-b', [job]),
    ]);

    expect([a.length, b.length].sort()).toEqual([0, 1]);
    const winner = a.length === 1 ? 'run-a' : 'run-b';
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: winner,
    });
    expect(await db.getState(job, 'running')).toBeUndefined();
  });

  test('drops only the jobs another run has claimed', async () => {
    const claimed = buildJob();
    const free = buildJob({ jobKey: 'build_dev' });
    await filter('run-a', [claimed]);

    expect(await filter('run-b', [claimed, free])).toEqual([free]);
  });

  test('keeps a job again for the run that claimed it', async () => {
    const job = buildJob();
    await filter('run-a', [job]);

    expect(await filter('run-a', [job])).toEqual([job]);
  });

  test('skips a job already in success state without claiming it', async () => {
    const job = buildJob({ commitTs: 1_700_000_000 });
    await putSuccess(job, 1_700_000_000);

    expect(await filter('run-a', [job])).toEqual([]);
    expect(await db.getState(job, 'claimed')).toBeUndefined();
  });

  test('keeps and claims a job whose commit is newer than its success state', async () => {
    const job = buildJob({ commitTs: 1_700_000_100 });
    await putSuccess(job, 1_700_000_000);

    expect(await filter('run-a', [job])).toEqual([job]);
    expect(await db.getState(job, 'claimed')).toMatchObject({
      runId: 'run-a',
    });
  });

  test('keeps a newer commit and drops an older one once the newer commit has claimed the job', async () => {
    const older = buildJob({ commitTs: 1_700_000_000, commitHash: 'aaa' });
    const newer = buildJob({ commitTs: 1_700_000_100, commitHash: 'bbb' });
    await filter('run-a', [older]);

    expect(await filter('run-b', [newer])).toEqual([newer]);
    expect(await filter('run-c', [older])).toEqual([]);
    expect(await db.getState(newer, 'claimed')).toMatchObject({
      runId: 'run-b',
      commitHash: 'bbb',
    });
  });

  test("skips a job another run is still building even after that run's claim has expired", async () => {
    const job = buildJob({ commitTs: 1_700_000_000 });
    await putRunning(job, {
      runId: 'run-a',
      commitTs: 1_700_000_000,
      ttl: now + 60,
    });

    expect(await filter('run-b', [job])).toEqual([]);
    expect(await db.getState(job, 'claimed')).toBeUndefined();
  });

  test('keeps a job whose running state has expired, belongs to this run, or is for an older commit', async () => {
    const expired = buildJob({ jobKey: 'expired', commitTs: 1_700_000_000 });
    const own = buildJob({ jobKey: 'own', commitTs: 1_700_000_000 });
    const older = buildJob({ jobKey: 'older', commitTs: 1_700_000_100 });
    await putRunning(expired, {
      runId: 'run-a',
      commitTs: 1_700_000_000,
      ttl: now - 1,
    });
    await putRunning(own, {
      runId: 'run-b',
      commitTs: 1_700_000_000,
      ttl: now + 60,
    });
    await putRunning(older, {
      runId: 'run-a',
      commitTs: 1_700_000_000,
      ttl: now + 60,
    });

    expect(await filter('run-b', [expired, own, older])).toEqual([
      expired,
      own,
      older,
    ]);
  });

  test('skips a job another run is building for a newer commit, even after that running state has expired', async () => {
    const job = buildJob({ commitTs: 1_700_000_000 });
    await putRunning(job, {
      runId: 'run-a',
      commitTs: 1_700_000_100,
      ttl: now - 1,
    });

    expect(await filter('run-b', [job])).toEqual([]);
    expect(await db.getState(job, 'claimed')).toBeUndefined();
  });
});
