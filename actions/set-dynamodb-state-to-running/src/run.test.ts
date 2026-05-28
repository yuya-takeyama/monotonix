import {
  ConditionalCheckFailedException,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { jest } from '@jest/globals';
import { Job } from '@monotonix/schema';

jest.unstable_mockModule('@actions/core', () => ({
  getState: jest.fn(),
  notice: jest.fn(),
  saveState: jest.fn(),
}));

const { notice, saveState } = await import('@actions/core');
const { run } = await import('./run');

const createTestJob = (): Job => ({
  app: {
    depends_on: [],
    metadata: {},
  },
  context: {
    dedupe_key: 'pull_request#123',
    github_ref: 'refs/pull/123/merge',
    app_path: 'apps/foo',
    root_dir: 'apps',
    job_key: 'build',
    last_commit: { hash: 'abc123', timestamp: 123456 },
    label: 'apps/foo / build',
  },
  on: { pull_request: null },
  configs: {},
  params: {},
  metadata: {},
});

const createDocClient = () =>
  ({
    send: jest.fn(),
  }) as unknown as DynamoDBDocumentClient;

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns shouldRun true and saves claimed state when running state is claimed', async () => {
    const docClient = createDocClient();
    jest.spyOn(docClient, 'send').mockResolvedValueOnce({});

    await expect(
      run({
        table: 'monotonix-state',
        region: 'ap-northeast-1',
        job: createTestJob(),
        ttl: 999999,
        docClient,
      }),
    ).resolves.toEqual({ shouldRun: true });

    expect(docClient.send).toHaveBeenCalledTimes(1);
    expect(jest.mocked(saveState)).toHaveBeenCalledWith(
      'MONOTONIX_DYNAMODB_RUNNING_STATE_CLAIMED',
      'true',
    );
  });

  it('returns shouldRun false when a newer commit is already running', async () => {
    const docClient = createDocClient();
    jest.spyOn(docClient, 'send').mockRejectedValueOnce(
      new ConditionalCheckFailedException({
        $metadata: {},
        message: 'conditional check failed',
      }),
    );

    await expect(
      run({
        table: 'monotonix-state',
        region: 'ap-northeast-1',
        job: createTestJob(),
        ttl: 999999,
        docClient,
      }),
    ).resolves.toEqual({ shouldRun: false });

    expect(jest.mocked(notice)).toHaveBeenCalledWith(
      'apps/foo / build: A job is already running for a newer commit',
    );
    expect(jest.mocked(saveState)).not.toHaveBeenCalledWith(
      'MONOTONIX_DYNAMODB_RUNNING_STATE_CLAIMED',
      'true',
    );
  });

  it('throws non-conditional errors', async () => {
    const docClient = createDocClient();
    const error = new Error('unexpected failure');
    jest.spyOn(docClient, 'send').mockRejectedValueOnce(error);

    await expect(
      run({
        table: 'monotonix-state',
        region: 'ap-northeast-1',
        job: createTestJob(),
        ttl: 999999,
        docClient,
      }),
    ).rejects.toThrow(error);
  });

  it('creates a DynamoDB document client when one is not provided', async () => {
    const docClient = createDocClient();
    const fromSpy = jest
      .spyOn(DynamoDBDocumentClient, 'from')
      .mockReturnValueOnce(docClient);
    jest.spyOn(docClient, 'send').mockResolvedValueOnce({});

    await run({
      table: 'monotonix-state',
      region: 'ap-northeast-1',
      job: createTestJob(),
      ttl: 999999,
    });

    expect(fromSpy).toHaveBeenCalledWith(expect.any(DynamoDBClient));
  });
});
