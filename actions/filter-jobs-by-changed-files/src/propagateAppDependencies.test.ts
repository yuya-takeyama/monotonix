import {
  getAffectedAppsFromChangedFiles,
  propagateAppDependencies,
  filterJobsByAppDependencies,
} from './propagateAppDependencies';
import { Job } from '@monotonix/schema';

const createMockJob = (
  appName: string,
  appPath: string,
  dependsOn?: string[],
  jobKey = 'build',
): Job => ({
  app: {
    name: appName,
    depends_on: dependsOn,
  },
  context: {
    dedupe_key: 'test',
    github_ref: 'refs/heads/main',
    app_path: appPath,
    job_key: jobKey,
    last_commit: {
      hash: 'abc123',
      timestamp: 1234567890,
    },
    label: `${appName} / ${jobKey}`,
  },
  on: {
    push: { branches: ['main'] },
    pull_request: null,
    pull_request_target: null,
  },
  configs: {},
  params: {},
});

describe('getAffectedAppsFromChangedFiles', () => {
  it('should identify apps from changed files', () => {
    const jobs = [
      createMockJob('foo', 'apps/foo'),
      createMockJob('bar', 'apps/bar'),
      createMockJob('foo/cmd/api-server', 'apps/foo/cmd/api-server'),
    ];
    const changedFiles = ['apps/foo/test-file.txt', 'apps/bar/package.json'];

    const result = getAffectedAppsFromChangedFiles(changedFiles, jobs);

    expect(result.sort()).toEqual(['bar', 'foo']);
  });

  it('should handle nested app paths correctly', () => {
    const jobs = [
      createMockJob('foo', 'apps/foo'),
      createMockJob('foo/cmd/api-server', 'apps/foo/cmd/api-server'),
    ];
    const changedFiles = ['apps/foo/cmd/api-server/main.go'];

    const result = getAffectedAppsFromChangedFiles(changedFiles, jobs);

    expect(result).toEqual(['foo/cmd/api-server']);
  });

  it('should handle exact path matches', () => {
    const jobs = [createMockJob('foo', 'apps/foo')];
    const changedFiles = ['apps/foo'];

    const result = getAffectedAppsFromChangedFiles(changedFiles, jobs);

    expect(result).toEqual(['foo']);
  });
});

describe('propagateAppDependencies', () => {
  it('should propagate dependencies', () => {
    const jobs = [
      createMockJob('shared-lib', 'apps/shared-lib'),
      createMockJob('api-server', 'apps/api-server', ['shared-lib']),
      createMockJob('web-app', 'apps/web-app'),
    ];
    const affectedApps = ['shared-lib'];

    const result = propagateAppDependencies(affectedApps, jobs);

    expect(result.sort()).toEqual(['api-server', 'shared-lib']);
  });

  it('should handle transitive dependencies', () => {
    const jobs = [
      createMockJob('core', 'apps/core'),
      createMockJob('shared-lib', 'apps/shared-lib', ['core']),
      createMockJob('api-server', 'apps/api-server', ['shared-lib']),
    ];
    const affectedApps = ['core'];

    const result = propagateAppDependencies(affectedApps, jobs);

    expect(result.sort()).toEqual(['api-server', 'core', 'shared-lib']);
  });

  it('should handle multiple dependencies', () => {
    const jobs = [
      createMockJob('auth', 'apps/auth'),
      createMockJob('shared-lib', 'apps/shared-lib'),
      createMockJob('api-server', 'apps/api-server', ['auth', 'shared-lib']),
    ];
    const affectedApps = ['auth'];

    const result = propagateAppDependencies(affectedApps, jobs);

    expect(result.sort()).toEqual(['api-server', 'auth']);
  });
});

describe('filterJobsByAppDependencies', () => {
  it('should handle playground scenario: foo file change triggers foo/cmd/api-server jobs', () => {
    const jobs = [
      // foo app (no pull_request_target job in playground)
      createMockJob('foo', 'apps/foo', undefined, 'go_test'),
      // foo/cmd/api-server with dependencies on foo
      createMockJob('foo/cmd/api-server', 'apps/foo/cmd/api-server', ['foo'], 'build_dev_pr'),
      createMockJob('foo/cmd/worker', 'apps/foo/cmd/worker', ['foo'], 'build_dev_pr'),
      // Other apps
      createMockJob('hello-world', 'apps/hello-world', undefined, 'build_dev_pr'),
      createMockJob('echo', 'apps/echo', ['pkg/common'], 'build_dev_pr'),
    ];
    const changedFiles = ['apps/foo/test-file.txt'];

    const result = filterJobsByAppDependencies(changedFiles, jobs);

    // Should include foo (directly affected) and dependent apps foo/cmd/api-server, foo/cmd/worker
    // Note: In actual playground, foo would be filtered out later because it has no pull_request_target job
    expect(result).toHaveLength(3);
    expect(result.map(job => job.app.name).sort()).toEqual([
      'foo',
      'foo/cmd/api-server',
      'foo/cmd/worker',
    ]);
  });

  it('should handle direct file changes', () => {
    const jobs = [
      createMockJob('foo', 'apps/foo'),
      createMockJob('bar', 'apps/bar', ['foo']),
    ];
    const changedFiles = ['apps/bar/main.go'];

    const result = filterJobsByAppDependencies(changedFiles, jobs);

    // Should include only bar app (direct change, no dependencies triggered)
    expect(result).toHaveLength(1);
    expect(result[0]?.app.name).toBe('bar');
  });

  it('should handle both direct and dependency changes', () => {
    const jobs = [
      createMockJob('foo', 'apps/foo'),
      createMockJob('bar', 'apps/bar', ['foo']),
      createMockJob('baz', 'apps/baz'),
    ];
    const changedFiles = ['apps/foo/main.go', 'apps/baz/main.go'];

    const result = filterJobsByAppDependencies(changedFiles, jobs);

    // Should include foo (direct), bar (dependency), and baz (direct)
    expect(result).toHaveLength(3);
    expect(result.map(job => job.app.name).sort()).toEqual(['bar', 'baz', 'foo']);
  });
});