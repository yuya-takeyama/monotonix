import { Job } from '@monotonix/schema';
import {
  jobMatchesChangedFiles,
  matchesDependency,
  PathInfo,
  resolveDependencyPaths,
} from './run';

describe('matchesDependency', () => {
  describe('directory dependencies', () => {
    it('matches files within the directory', () => {
      expect(
        matchesDependency('apps/foo/src/main.go', {
          path: 'apps/foo/',
          isDirectory: true,
        }),
      ).toBe(true);
      expect(
        matchesDependency('apps/foo/pkg/utils/helper.go', {
          path: 'apps/foo/',
          isDirectory: true,
        }),
      ).toBe(true);
    });

    it('does not match files outside the directory', () => {
      expect(
        matchesDependency('apps/bar/src/main.go', {
          path: 'apps/foo/',
          isDirectory: true,
        }),
      ).toBe(false);
      expect(
        matchesDependency('apps/foobar/main.go', {
          path: 'apps/foo/',
          isDirectory: true,
        }),
      ).toBe(false);
    });

    it('handles directories without trailing slash', () => {
      expect(
        matchesDependency('apps/foo/main.go', {
          path: 'apps/foo',
          isDirectory: true,
        }),
      ).toBe(true);
      expect(
        matchesDependency('apps/foo/src/main.go', {
          path: 'apps/foo',
          isDirectory: true,
        }),
      ).toBe(true);
    });
  });

  describe('file dependencies', () => {
    it('matches exact file path', () => {
      expect(
        matchesDependency('apps/foo/go.mod', {
          path: 'apps/foo/go.mod',
          isDirectory: false,
        }),
      ).toBe(true);
      expect(
        matchesDependency('apps/foo/package.json', {
          path: 'apps/foo/package.json',
          isDirectory: false,
        }),
      ).toBe(true);
    });

    it('does not match similar but different files', () => {
      expect(
        matchesDependency('apps/foo/go.mod.backup', {
          path: 'apps/foo/go.mod',
          isDirectory: false,
        }),
      ).toBe(false);
      expect(
        matchesDependency('apps/foo/go.module', {
          path: 'apps/foo/go.mod',
          isDirectory: false,
        }),
      ).toBe(false);
    });

    it('does not match files within a directory with the same name', () => {
      // Files should only match exactly
      expect(
        matchesDependency('apps/foo/go.mod/nested.txt', {
          path: 'apps/foo/go.mod',
          isDirectory: false,
        }),
      ).toBe(false);
    });
  });
});

describe('resolveDependencyPaths', () => {
  const stubGetPathInfo = (path: string): PathInfo => {
    // Stub implementation based on path patterns
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
    const dependencies = ['apps/shared', 'apps/go.mod', 'apps/package.json'];
    const result = resolveDependencyPaths(
      dependencies,
      'apps',
      stubGetPathInfo,
    );

    expect(result).toEqual([
      { path: 'apps/shared', isDirectory: true },
      { path: 'apps/go.mod', isDirectory: false },
      { path: 'apps/package.json', isDirectory: false },
    ]);
  });

  it('handles empty dependencies', () => {
    const result = resolveDependencyPaths([], 'apps', stubGetPathInfo);
    expect(result).toEqual([]);
  });
});

describe('jobMatchesChangedFiles', () => {
  const createTestJob = (
    appPath: string,
    dependencies: string[] = [],
  ): Job => ({
    app: {
      depends_on: dependencies,
    },
    context: {
      dedupe_key: 'test',
      github_ref: 'refs/heads/main',
      app_path: appPath,
      root_dir: 'apps',
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

    expect(jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos)).toBe(
      true,
    );
  });

  it('does not match files in similarly named directories', () => {
    const job = createTestJob('apps/foo');
    const changedFiles = ['apps/foobar/main.go', 'apps/foo-other/main.go'];
    const dependencyPathInfos: PathInfo[] = [];

    expect(jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos)).toBe(
      false,
    );
  });

  it('matches when dependency files change', () => {
    const job = createTestJob('apps/foo', ['apps/shared', 'apps/go.mod']);
    const changedFiles = ['apps/shared/utils.go', 'apps/go.mod'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/shared', isDirectory: true },
      { path: 'apps/go.mod', isDirectory: false },
    ];

    expect(jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos)).toBe(
      true,
    );
  });

  it('does not match when no relevant files change', () => {
    const job = createTestJob('apps/foo', ['apps/shared']);
    const changedFiles = ['apps/bar/main.go', 'README.md'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/shared', isDirectory: true },
    ];

    expect(jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos)).toBe(
      false,
    );
  });

  it('matches exact file dependencies', () => {
    const job = createTestJob('apps/web-app/cmd/api-server', [
      'apps/web-app/go.mod',
      'apps/web-app/go.sum',
    ]);
    const changedFiles = ['apps/web-app/go.mod'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/web-app/go.mod', isDirectory: false },
      { path: 'apps/web-app/go.sum', isDirectory: false },
    ];

    expect(jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos)).toBe(
      true,
    );
  });

  it('does not match partial file paths', () => {
    const job = createTestJob('apps/web-app/cmd/api-server', [
      'apps/web-app/go.mod',
    ]);
    const changedFiles = ['apps/web-app/go.mod.backup'];
    const dependencyPathInfos: PathInfo[] = [
      { path: 'apps/web-app/go.mod', isDirectory: false },
    ];

    expect(jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos)).toBe(
      false,
    );
  });
});
