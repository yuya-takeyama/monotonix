import { createJobConfig } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';
import { JobConfig, LocalConfig } from '@monotonix/schema';

describe('createJobConfig', () => {
  // @ts-ignore
  const stubContext = {
    ref: 'refs/heads/main',
  } as Context;

  const stubJob = {
    on: {
      push: {
        branches: ['main'],
      },
    },
    type: 'build',
    config: {
      foo: 'FOO',
    },
  };

  const stubLocalConfig: LocalConfig = {
    app: {
      name: 'test-app',
    },
    jobs: {
      job1: stubJob,
    },
  };

  const stubCommitInfo = {
    hash: '0000000000000000000000000000000000000000',
    timestamp: 0,
  };

  it('creates a job config with the correct structure', () => {
    const appPath = '/root/subdir';
    const jobKey = 'job1';

    const result = createJobConfig({
      localConfig: stubLocalConfig,
      appPath,
      lastCommit: stubCommitInfo,
      jobKey,
      job: stubJob,
      context: stubContext,
    });

    const expected: JobConfig = {
      app: {
        name: 'test-app',
      },
      app_context: {
        path: appPath,
        last_commit: stubCommitInfo,
        label: 'test-app / job1',
      },
      on: {
        push: {
          branches: ['main'],
        },
      },
      type: 'build',
      config: {
        foo: 'FOO',
      },
      keys: [
        ['app_path', appPath],
        ['job_key', jobKey],
        ['github_ref', stubContext.ref],
      ],
    };

    expect(result).toEqual(expected);
  });

  it('handles different job configurations', () => {
    const appPath = '/root/subdir';
    const jobKey = 'job2';
    const differentJob = {
      on: {
        pull_request: null,
      },
      type: 'test',
      config: {
        bar: 'BAR',
      },
    };

    const result = createJobConfig({
      localConfig: stubLocalConfig,
      appPath,
      lastCommit: stubCommitInfo,
      jobKey,
      job: differentJob,
      context: stubContext,
    });

    const expected: JobConfig = {
      app: {
        name: 'test-app',
      },
      app_context: {
        path: appPath,
        last_commit: stubCommitInfo,
        label: 'test-app / job2',
      },
      on: {
        pull_request: null,
      },
      type: 'test',
      config: {
        bar: 'BAR',
      },
      keys: [
        ['app_path', appPath],
        ['job_key', jobKey],
        ['github_ref', stubContext.ref],
      ],
    };

    expect(result).toEqual(expected);
  });
});
