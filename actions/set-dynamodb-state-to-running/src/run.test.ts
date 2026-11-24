import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { acquireState, stateKey } from '@monotonix/dynamodb-common';
import {
  buildJob,
  createTestTable,
  testEndpoint,
} from '@monotonix/dynamodb-common/testing';
import type { Job } from '@monotonix/schema';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { run } from './run';
import { runPost } from './runPost';

describe.skipIf(!testEndpoint)('set-dynamodb-state-to-running', () => {
  const now = 1_800_000_000;
  const ttlSeconds = 3600;
  const x = buildJob({ commitTs: 1_764_000_000, commitHash: 'c0ffee0' });
  const y = buildJob({ commitTs: 1_764_000_100, commitHash: 'beef001' });
  const z = buildJob({ commitTs: 1_764_000_200, commitHash: 'cafe002' });
  let db: Awaited<ReturnType<typeof createTestTable>>;

  beforeEach(async () => {
    db = await createTestTable();
  });

  afterEach(async () => {
    await db.drop();
  });

  // What filter-jobs-by-dynamodb-state does for each job it keeps.
  const setup = async (runId: string, job: Job) =>
    (
      await acquireState({
        docClient: db.docClient,
        table: db.table,
        job,
        jobStatus: 'claimed',
        runId,
        now,
        ttlSeconds,
      })
    ).acquired;

  const start = (runId: string, job: Job, table = db.table) =>
    run({
      docClient: db.docClient,
      table,
      job,
      runId,
      now: now + 30,
      ttlSeconds,
    });

  const finish = (
    runId: string,
    job: Job,
    acquired: boolean,
    jobStatus: 'success' | 'failure',
  ) =>
    runPost({
      docClient: db.docClient,
      table: db.table,
      job,
      acquired,
      jobStatus,
      runId,
      ttl: now + 86400,
    });

  const putRunningWithoutRunId = (job: Job) =>
    db.docClient.send(
      new PutCommand({
        TableName: db.table,
        Item: {
          ...stateKey(job, 'running'),
          appPath: job.context.app_path,
          jobKey: job.context.job_key,
          jobStatus: 'running',
          commitTs: job.context.last_commit.timestamp,
          commitHash: job.context.last_commit.hash,
          ttl: now + ttlSeconds,
        },
      }),
    );

  test('starts the job its setup claimed, then records success and releases both states', async () => {
    await setup('run-a', x);

    await expect(start('run-a', x)).resolves.toBeUndefined();
    expect(await db.getState(x, 'running')).toMatchObject({
      runId: 'run-a',
      commitHash: 'c0ffee0',
      ttl: now + 30 + ttlSeconds,
    });
    expect(await db.getState(x, 'claimed')).toMatchObject({ runId: 'run-a' });

    await finish('run-a', x, true, 'success');

    expect(await db.getState(x, 'success')).toMatchObject({
      commitHash: 'c0ffee0',
    });
    expect(await db.getState(x, 'running')).toBeUndefined();
    expect(await db.getState(x, 'claimed')).toBeUndefined();
  });

  test('releases both states without recording success when the job fails', async () => {
    await setup('run-a', x);
    await start('run-a', x);

    await finish('run-a', x, true, 'failure');

    expect(await db.getState(x, 'success')).toBeUndefined();
    expect(await db.getState(x, 'running')).toBeUndefined();
    expect(await db.getState(x, 'claimed')).toBeUndefined();
  });

  test('lets only one of two runs start the same commit at the same time', async () => {
    const results = await Promise.allSettled([
      start('run-a', x),
      start('run-b', x),
    ]);

    expect(results.map(r => r.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    const winner = results[0]?.status === 'fulfilled' ? 'run-a' : 'run-b';
    const loser = results.find(r => r.status === 'rejected');
    expect(loser?.reason).toBeInstanceOf(Error);
    expect((loser?.reason as Error).message).toBe(
      `apps/web / build_prd: Run ${winner} holds the running state for commit c0ffee0. Another run is already running the same commit.`,
    );
    expect(await db.getState(x, 'running')).toMatchObject({ runId: winner });
  });

  test('fails an older commit whose build starts after a newer commit started, even when a third commit has claimed the job since', async () => {
    await setup('run-a', x);
    await setup('run-b', y);
    await start('run-b', y);
    await setup('run-c', z);

    await expect(start('run-a', x)).rejects.toThrow(
      /Run run-b holds the running state for commit beef001. A newer commit is already running./,
    );
    await finish('run-a', x, false, 'failure');

    expect(await db.getState(x, 'running')).toMatchObject({
      runId: 'run-b',
      commitHash: 'beef001',
    });
    expect(await db.getState(x, 'claimed')).toMatchObject({
      runId: 'run-c',
      commitHash: 'cafe002',
    });
  });

  test('starts an older commit while a newer commit is only claimed', async () => {
    await setup('run-a', x);
    await setup('run-b', y);

    await expect(start('run-a', x)).resolves.toBeUndefined();
    await expect(start('run-b', y)).resolves.toBeUndefined();
    await finish('run-a', x, true, 'success');

    expect(await db.getState(x, 'success')).toMatchObject({
      commitHash: 'c0ffee0',
    });
    expect(await db.getState(x, 'running')).toMatchObject({ runId: 'run-b' });
    expect(await db.getState(x, 'claimed')).toMatchObject({ runId: 'run-b' });
  });

  test('records no success for a run that did not acquire the running state, even when its job succeeds', async () => {
    await setup('run-b', y);
    await start('run-b', y);

    await expect(start('run-a', x)).rejects.toThrow(/Run run-b holds/);
    await finish('run-a', x, false, 'success');

    expect(await db.getState(x, 'success')).toBeUndefined();
  });

  test('re-running all jobs claims and starts again while the first attempt still holds its claim', async () => {
    await setup('run-a', x);

    expect(await setup('run-a', x)).toBe(true);
    await expect(start('run-a', x)).resolves.toBeUndefined();
  });

  test('re-running all jobs claims and starts again after a failed attempt released its states', async () => {
    await setup('run-a', x);
    await start('run-a', x);
    await finish('run-a', x, true, 'failure');

    expect(await setup('run-a', x)).toBe(true);
    await expect(start('run-a', x)).resolves.toBeUndefined();
  });

  test('re-running a failed build job starts it and releases the claim its setup still holds', async () => {
    await setup('run-a', x);

    await expect(start('run-a', x)).resolves.toBeUndefined();
    await finish('run-a', x, true, 'success');

    expect(await db.getState(x, 'success')).toMatchObject({
      commitHash: 'c0ffee0',
    });
    expect(await db.getState(x, 'claimed')).toBeUndefined();
  });

  test('re-running a failed build job starts it after the first attempt released its states', async () => {
    await setup('run-a', x);
    await start('run-a', x);
    await finish('run-a', x, true, 'failure');

    await expect(start('run-a', x)).resolves.toBeUndefined();
    await finish('run-a', x, true, 'success');

    expect(await db.getState(x, 'success')).toMatchObject({
      commitHash: 'c0ffee0',
    });
    expect(await db.getState(x, 'running')).toBeUndefined();
  });

  test('releases the claim when the main step fails with an error other than a failed condition', async () => {
    await setup('run-a', x);

    await expect(
      start('run-a', x, `${db.table}-missing`),
    ).rejects.toMatchObject({ name: 'ResourceNotFoundException' });
    await finish('run-a', x, false, 'failure');

    expect(await db.getState(x, 'claimed')).toBeUndefined();
    expect(await db.getState(x, 'running')).toBeUndefined();
    expect(await db.getState(x, 'success')).toBeUndefined();
  });

  test('a run that fails to start releases its own claim and leaves the running state without runId that blocked it', async () => {
    await putRunningWithoutRunId(x);
    await setup('run-a', x);

    await expect(start('run-a', x)).rejects.toThrow(
      'apps/web / build_prd: Run (unknown) holds the running state for commit c0ffee0. Another run is already running the same commit.',
    );
    await finish('run-a', x, false, 'failure');

    expect(await db.getState(x, 'claimed')).toBeUndefined();
    expect(await db.getState(x, 'running')).toEqual({
      ...stateKey(x, 'running'),
      appPath: 'apps/web',
      jobKey: 'build_prd',
      jobStatus: 'running',
      commitTs: 1_764_000_000,
      commitHash: 'c0ffee0',
      ttl: now + ttlSeconds,
    });
  });

  test('a newer commit starts over a running state without runId for an older commit', async () => {
    await putRunningWithoutRunId(x);
    await setup('run-b', y);

    await expect(start('run-b', y)).resolves.toBeUndefined();
    expect(await db.getState(x, 'running')).toMatchObject({
      runId: 'run-b',
      commitHash: 'beef001',
    });
  });
});
