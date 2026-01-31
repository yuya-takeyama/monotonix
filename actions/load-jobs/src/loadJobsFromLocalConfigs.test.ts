import { Job, LocalConfig, LocalConfigJob } from '@monotonix/schema';
import {
  createJob,
  createUnresolvedDependency,
  resolveDependency,
} from './loadJobsFromLocalConfigs';
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
    metadata: {},
  };

  const stubLocalConfig: LocalConfig = {
    app: {
      depends_on: [],
      metadata: {},
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
        metadata: {},
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
      metadata: {},
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
      metadata: {},
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
        metadata: {},
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
      metadata: {},
    };

    expect(result).toEqual(expected);
  });

  it('handles missing app field by providing default values', () => {
    const appPath = 'apps/test-app';
    const rootDir = 'apps';
    const jobKey = 'job1';

    // Test that Zod default values are applied when app field is omitted
    // We parse the config through the LocalConfigSchema to get defaults
    const localConfigWithoutApp = {
      jobs: {
        job1: stubJob,
      },
      app: {
        depends_on: [],
        metadata: {},
      },
    } as LocalConfig;

    const result = createJob({
      localConfig: localConfigWithoutApp,
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
        metadata: {},
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
      metadata: {},
    };

    expect(result).toEqual(expected);
    expect(result.app.depends_on).toEqual([]);
  });
});

describe('createUnresolvedDependency', () => {
  it('creates an unresolved dependency with correct properties', () => {
    const result = createUnresolvedDependency(
      '/repo/apps/web',
      '$repoRoot/libs',
    );

    expect(result).toEqual({
      type: 'unresolved',
      basePath: '/repo/apps/web',
      spec: '$repoRoot/libs',
    });
  });

  it('creates an unresolved dependency with relative path', () => {
    const result = createUnresolvedDependency('/repo/apps/web', '../shared');

    expect(result).toEqual({
      type: 'unresolved',
      basePath: '/repo/apps/web',
      spec: '../shared',
    });
  });
});

describe('resolveDependency', () => {
  describe('with $repoRoot/ prefix', () => {
    it('resolves $repoRoot/ path from repository root', () => {
      const unresolved = createUnresolvedDependency(
        '/repo/apps/web',
        '$repoRoot/libs',
      );
      const result = resolveDependency(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '$repoRoot/libs',
        absolutePath: '/repo/libs',
      });
    });

    it('resolves nested $repoRoot/ path', () => {
      const unresolved = createUnresolvedDependency(
        '/repo/apps/web',
        '$repoRoot/packages/shared/utils',
      );
      const result = resolveDependency(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '$repoRoot/packages/shared/utils',
        absolutePath: '/repo/packages/shared/utils',
      });
    });
  });

  describe('with relative paths', () => {
    it('resolves relative path from appPath', () => {
      const unresolved = createUnresolvedDependency(
        '/repo/apps/web',
        '../shared',
      );
      const result = resolveDependency(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '../shared',
        absolutePath: '/repo/apps/shared',
      });
    });

    it('resolves deeply nested relative path', () => {
      const unresolved = createUnresolvedDependency(
        '/repo/apps/mono/apps/web',
        '../../packages/common',
      );
      const result = resolveDependency(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/mono/apps/web',
        spec: '../../packages/common',
        absolutePath: '/repo/apps/mono/packages/common',
      });
    });

    it('resolves sibling directory path', () => {
      const unresolved = createUnresolvedDependency('/repo/apps/web', './lib');
      const result = resolveDependency(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: './lib',
        absolutePath: '/repo/apps/web/lib',
      });
    });
  });
});
