import { Job, LocalConfig, LocalConfigJob } from '@monotonix/schema';
import { createJob, extractAppLabel } from './loadJobsFromLocalConfigs';
import { Event } from './schema';

describe('extractAppLabel', () => {
  it('removes root directory from app path', () => {
    expect(extractAppLabel('apps/my-app', 'apps')).toBe('my-app');
    expect(extractAppLabel('apps/backend/api', 'apps')).toBe('backend/api');
  });

  it('handles root directory with trailing slash', () => {
    expect(extractAppLabel('apps/my-app', 'apps/')).toBe('my-app');
  });

  it('returns full path when not starting with root directory', () => {
    expect(extractAppLabel('other/my-app', 'apps')).toBe('other/my-app');
  });

  it('handles empty root directory', () => {
    expect(extractAppLabel('apps/my-app', '')).toBe('apps/my-app');
  });

  it('handles exact match of root directory', () => {
    expect(extractAppLabel('apps', 'apps')).toBe('');
  });
});

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
    const appPath = 'apps/test-app';
    const rootDir = 'apps';
    const jobKey = 'job1';

    const result = createJob({
      localConfig: stubLocalConfig,
      dedupeKey: stubEvent.ref,
      appPath,
      lastCommit: stubCommitInfo,
      jobKey,
      job: stubJob,
      event: stubEvent as Event,
      rootDir,
    });

    const expected: Job = {
      app: {
        depends_on: [],
      },
      context: {
        dedupe_key: stubEvent.ref,
        github_ref: stubEvent.ref,
        app_path: appPath,
        root_dir: rootDir,
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
    const appPath = 'apps/test-app';
    const rootDir = 'apps';
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
      event: stubEvent as Event,
      rootDir,
    });

    const expected: Job = {
      app: {
        depends_on: [],
      },
      context: {
        dedupe_key: stubEvent.ref,
        github_ref: stubEvent.ref,
        app_path: appPath,
        root_dir: rootDir,
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
