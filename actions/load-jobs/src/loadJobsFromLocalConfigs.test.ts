import { Job, LocalConfig, LocalConfigJob } from '@monotonix/schema';
import { createJob } from './loadJobsFromLocalConfigs';
import { Event } from './schema';

describe('createJob', () => {
  const stubEvent: Pick<Event, 'ref'> = {
    ref: 'refs/heads/main',
  };

  const stubJob: LocalConfigJob = {
    on: {
      push: {
        branches: ['main'],
      },
    },
    configs: {
      generic: {
        foo: 'FOO',
      },
    },
  };

  const stubLocalConfig: LocalConfig = {
    app: {
      name: 'test-app',
      depends_on: [],
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

    const result = createJob({
      localConfig: stubLocalConfig,
      dedupeKey: stubEvent.ref,
      appPath,
      lastCommit: stubCommitInfo,
      jobKey,
      job: stubJob,
      // @ts-expect-error
      event: stubEvent,
    });

    const expected: Job = {
      app: {
        name: 'test-app',
        depends_on: [],
      },
      context: {
        dedupe_key: stubEvent.ref,
        github_ref: stubEvent.ref,
        app_path: appPath,
        job_key: jobKey,
        last_commit: stubCommitInfo,
        label: 'test-app / job1',
      },
      on: {
        push: {
          branches: ['main'],
        },
      },
      configs: {
        generic: {
          foo: 'FOO',
        },
      },
      params: {},
    };

    expect(result).toEqual(expected);
  });

  it('handles different job configurations', () => {
    const appPath = '/root/subdir';
    const jobKey = 'job2';
    const differentJob: LocalConfigJob = {
      on: {
        pull_request: null,
      },
      configs: {
        generic: {
          bar: 'BAR',
        },
      },
    };

    const result = createJob({
      localConfig: stubLocalConfig,
      dedupeKey: stubEvent.ref,
      appPath,
      lastCommit: stubCommitInfo,
      jobKey,
      job: differentJob,
      // @ts-expect-error
      event: stubEvent,
    });

    const expected: Job = {
      app: {
        name: 'test-app',
        depends_on: [],
      },
      context: {
        dedupe_key: stubEvent.ref,
        github_ref: stubEvent.ref,
        app_path: appPath,
        job_key: jobKey,
        last_commit: stubCommitInfo,
        label: 'test-app / job2',
      },
      on: {
        pull_request: null,
      },
      configs: {
        generic: {
          bar: 'BAR',
        },
      },
      params: {},
    };

    expect(result).toEqual(expected);
  });
});
