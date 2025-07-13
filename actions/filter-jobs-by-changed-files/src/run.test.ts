import {
  matchesDependency,
  resolveDependencyPaths,
  jobMatchesChangedFiles,
  PathInfo,
} from './run';
import { Job } from '@monotonix/schema';

describe('matchesDependency', () => {
  describe('directory dependencies', () => {
    it('matches files within the directory', () => {
      expect(matchesDependency('apps/foo/src/main.go', 'apps/foo/', true)).toBe(
        true,
      );
      expect(
        matchesDependency('apps/foo/pkg/utils/helper.go', 'apps/foo/', true),
      ).toBe(true);
    });

    it('does not match files outside the directory', () => {
      expect(matchesDependency('apps/bar/src/main.go', 'apps/foo/', true)).toBe(
        false,
      );
      expect(matchesDependency('apps/foobar/main.go', 'apps/foo/', true)).toBe(
        false,
      );
    });

    it('handles directories without trailing slash', () => {
      expect(matchesDependency('apps/foo/main.go', 'apps/foo', true)).toBe(
        true,
      );
      expect(matchesDependency('apps/foo/src/main.go', 'apps/foo', true)).toBe(
        true,
      );
    });
  });

  describe('file dependencies', () => {
    it('matches exact file path', () => {
      expect(
        matchesDependency('apps/foo/go.mod', 'apps/foo/go.mod', false),
      ).toBe(true);
      expect(
        matchesDependency(
          'apps/foo/package.json',
          'apps/foo/package.json',
          false,
        ),
      ).toBe(true);
    });

    it('does not match similar but different files', () => {
      expect(
        matchesDependency('apps/foo/go.mod.backup', 'apps/foo/go.mod', false),
      ).toBe(false);
      expect(
        matchesDependency('apps/foo/go.module', 'apps/foo/go.mod', false),
      ).toBe(false);
    });

    it('does not match files within a directory with the same name', () => {
      // Files should only match exactly
      expect(
        matchesDependency(
          'apps/foo/go.mod/nested.txt',
          'apps/foo/go.mod',
          false,
        ),
      ).toBe(false);
    });
  });
});

describe('resolveDependencyPaths', () => {
  const mockGetPathInfo = (path: string): PathInfo => {
    // Mock implementation based on path patterns
    if (
      path.endsWith('.mod') ||
      path.endsWith('.json') ||
      path.endsWith('.txt')
    ) {
      return { path, isDirectory: false };
    }
    return { path, isDirectory: true };
  };

  it('resolves dependency paths correctly', () => {
    const dependencies = ['shared', 'go.mod', 'package.json'];
    const result = resolveDependencyPaths(
      dependencies,
      'apps',
      mockGetPathInfo,
    );

    expect(result).toEqual([
      { path: 'apps/shared', isDirectory: true },
      { path: 'apps/go.mod', isDirectory: false },
      { path: 'apps/package.json', isDirectory: false },
    ]);
  });

  it('handles empty dependencies', () => {
    const result = resolveDependencyPaths([], 'apps', mockGetPathInfo);
    expect(result).toEqual([]);
  });
});

describe('jobMatchesChangedFiles', () => {
  const createTestJob = (
    appPath: string,
    dependencies: string[] = [],
  ): Job => ({
    app: {
      name: 'test-app',
      depends_on: dependencies,
    },
    context: {
      dedupe_key: 'test',
      github_ref: 'refs/heads/main',
      app_path: appPath,
      job_key: 'build',
      last_commit: { hash: 'abc123', timestamp: 123456 },
      label: 'test-app / build',
    },
    on: { push: null },
    configs: {},
    params: {},
  });

  it('matches when files are within app path', () => {
    const job = createTestJob('apps/foo');
    const changedFiles = ['apps/foo/main.go', 'apps/bar/main.go'];
    const dependencyPathInfos: PathInfo[] = [];

    expect(
      jobMatchesChangedFiles(job, changedFiles, 'apps', dependencyPathInfos),
    ).toBe(true);
  });

  it('matches when dependency files change', () => {
    const job = createTestJob('apps/foo', ['shared', 'go.mod']);
    const changedFiles = ['apps/shared/utils.go', 'apps/go.mod'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/shared', isDirectory: true },
      { path: 'apps/go.mod', isDirectory: false },
    ];

    expect(
      jobMatchesChangedFiles(job, changedFiles, 'apps', dependencyPathInfos),
    ).toBe(true);
  });

  it('does not match when no relevant files change', () => {
    const job = createTestJob('apps/foo', ['shared']);
    const changedFiles = ['apps/bar/main.go', 'README.md'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/shared', isDirectory: true },
    ];

    expect(
      jobMatchesChangedFiles(job, changedFiles, 'apps', dependencyPathInfos),
    ).toBe(false);
  });

  it('matches exact file dependencies', () => {
    const job = createTestJob('apps/web-app/cmd/api-server', [
      'web-app/go.mod',
      'web-app/go.sum',
    ]);
    const changedFiles = ['apps/web-app/go.mod'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/web-app/go.mod', isDirectory: false },
      { path: 'apps/web-app/go.sum', isDirectory: false },
    ];

    expect(
      jobMatchesChangedFiles(job, changedFiles, 'apps', dependencyPathInfos),
    ).toBe(true);
  });

  it('does not match partial file paths', () => {
    const job = createTestJob('apps/web-app/cmd/api-server', [
      'web-app/go.mod',
    ]);
    const changedFiles = ['apps/web-app/go.mod.backup'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/web-app/go.mod', isDirectory: false },
    ];

    expect(
      jobMatchesChangedFiles(job, changedFiles, 'apps', dependencyPathInfos),
    ).toBe(false);
  });
});
