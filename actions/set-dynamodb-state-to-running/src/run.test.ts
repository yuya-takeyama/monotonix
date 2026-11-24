import { claimRunningState } from '@monotonix/dynamodb-common';
import {
  buildJob,
  createTestTable,
  testEndpoint,
} from '@monotonix/dynamodb-common/testing';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { run } from './run';
import { runPost } from './runPost';

describe.skipIf(!testEndpoint)('set-dynamodb-state-to-running', () => {
  const now = 1_800_000_000;
  const ttlSeconds = 3600;
  const job = buildJob();
  let db: Awaited<ReturnType<typeof createTestTable>>;

  beforeEach(async () => {
    db = await createTestTable();
  });

  afterEach(async () => {
    await db.drop();
  });

  const claimInSetup = (runId: string) =>
    claimRunningState({
      docClient: db.docClient,
      table: db.table,
      job,
      runId,
      now,
      ttlSeconds,
    });

  const acquire = (runId: string) =>
    run({
      docClient: db.docClient,
      table: db.table,
      job,
      runId,
      now: now + 30,
      ttlSeconds,
    });

  const post = (runId: string, jobStatus: 'success' | 'failure') =>
    runPost({
      docClient: db.docClient,
      table: db.table,
      job,
      jobStatus,
      runId,
      ttl: now + 86400,
    });

  test('acquires the running state its own setup job claimed', async () => {
    await claimInSetup('run-a');

    await expect(acquire('run-a')).resolves.toBeUndefined();
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-a',
      ttl: now + 30 + ttlSeconds,
    });
  });

  test('acquires a running state nobody holds, as when re-running failed jobs', async () => {
    await claimInSetup('run-a');
    await acquire('run-a');
    await post('run-a', 'failure');

    await expect(acquire('run-a')).resolves.toBeUndefined();
    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-a',
    });
  });

  test('fails and names the holder when another run holds the running state', async () => {
    await claimInSetup('run-a');

    await expect(acquire('run-b')).rejects.toThrow(/Run run-a holds/);
  });

  test('post of the holding run records success and releases the claim', async () => {
    await claimInSetup('run-a');
    await acquire('run-a');

    await post('run-a', 'success');

    expect(await db.getState(job, 'running')).toBeUndefined();
    expect(await db.getState(job, 'success')).toMatchObject({
      commitTs: job.context.last_commit.timestamp,
      commitHash: job.context.last_commit.hash,
    });
  });

  test('post of the holding run releases the claim without success on failure', async () => {
    await claimInSetup('run-a');
    await acquire('run-a');

    await post('run-a', 'failure');

    expect(await db.getState(job, 'running')).toBeUndefined();
    expect(await db.getState(job, 'success')).toBeUndefined();
  });

  test('post of another run leaves the claim intact', async () => {
    await claimInSetup('run-a');
    await acquire('run-a');

    await post('run-b', 'failure');

    expect(await db.getState(job, 'running')).toMatchObject({
      runId: 'run-a',
    });
  });
});
