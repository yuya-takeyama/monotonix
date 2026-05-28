import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { jest } from '@jest/globals';
import { Job } from '@monotonix/schema';

jest.unstable_mockModule('@actions/core', () => ({
  notice: jest.fn(),
}));

const { notice } = await import('@actions/core');
const { runPost } = await import('./runPost');

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

describe('runPost', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when running state was not claimed', async () => {
    const docClient = createDocClient();

    await runPost({
      table: 'monotonix-state',
      region: 'ap-northeast-1',
      job: createTestJob(),
      jobStatus: 'success',
      ttl: 999999,
      runningStateClaimed: false,
      docClient,
    });

    expect(docClient.send).not.toHaveBeenCalled();
  });

  it('stores success state and deletes running state after a successful claimed job', async () => {
    const docClient = createDocClient();
    jest.spyOn(docClient, 'send').mockResolvedValue({});

    await runPost({
      table: 'monotonix-state',
      region: 'ap-northeast-1',
      job: createTestJob(),
      jobStatus: 'success',
      ttl: 999999,
      runningStateClaimed: true,
      docClient,
    });

    expect(docClient.send).toHaveBeenCalledTimes(2);
    expect(docClient.send).toHaveBeenNthCalledWith(1, expect.any(PutCommand));
    expect(docClient.send).toHaveBeenNthCalledWith(
      2,
      expect.any(DeleteCommand),
    );
  });

  it('only deletes running state after a failed claimed job', async () => {
    const docClient = createDocClient();
    jest.spyOn(docClient, 'send').mockResolvedValue({});

    await runPost({
      table: 'monotonix-state',
      region: 'ap-northeast-1',
      job: createTestJob(),
      jobStatus: 'failure',
      ttl: 999999,
      runningStateClaimed: true,
      docClient,
    });

    expect(docClient.send).toHaveBeenCalledTimes(1);
    expect(docClient.send).toHaveBeenCalledWith(expect.any(DeleteCommand));
  });

  it('only deletes running state after a cancelled claimed job', async () => {
    const docClient = createDocClient();
    jest.spyOn(docClient, 'send').mockResolvedValue({});

    await runPost({
      table: 'monotonix-state',
      region: 'ap-northeast-1',
      job: createTestJob(),
      jobStatus: 'cancelled',
      ttl: 999999,
      runningStateClaimed: true,
      docClient,
    });

    expect(docClient.send).toHaveBeenCalledTimes(1);
    expect(docClient.send).toHaveBeenCalledWith(expect.any(DeleteCommand));
  });

  it('does not fail when success state is already newer', async () => {
    const docClient = createDocClient();
    jest
      .spyOn(docClient, 'send')
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          $metadata: {},
          message: 'conditional check failed',
        }),
      )
      .mockResolvedValueOnce({});

    await expect(
      runPost({
        table: 'monotonix-state',
        region: 'ap-northeast-1',
        job: createTestJob(),
        jobStatus: 'success',
        ttl: 999999,
        runningStateClaimed: true,
        docClient,
      }),
    ).resolves.toBeUndefined();

    expect(jest.mocked(notice)).toHaveBeenCalledWith(
      'apps/foo / build: A newer or the same commit is already in success state',
    );
    expect(docClient.send).toHaveBeenCalledTimes(2);
  });

  it('does not fail when running state belongs to a newer commit', async () => {
    const docClient = createDocClient();
    jest
      .spyOn(docClient, 'send')
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(
        new ConditionalCheckFailedException({
          $metadata: {},
          message: 'conditional check failed',
        }),
      );

    await expect(
      runPost({
        table: 'monotonix-state',
        region: 'ap-northeast-1',
        job: createTestJob(),
        jobStatus: 'success',
        ttl: 999999,
        runningStateClaimed: true,
        docClient,
      }),
    ).resolves.toBeUndefined();

    expect(jest.mocked(notice)).toHaveBeenCalledWith(
      'apps/foo / build: A newer commit is already running',
    );
  });
});
