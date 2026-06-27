import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createUnresolvedPath,
  extractAppLabel,
  MONOTONIX_JOBS_ENV,
  MONOTONIX_JOBS_FILE_ENV,
  publishJobsResult,
  readJobsJsonInput,
  resolvePath,
  resolveToAbsolutePath,
} from './index';

describe('extractAppLabel', () => {
  describe('with empty rootDir', () => {
    test.each([
      ['', 'apps/echo', 'apps/echo'],
      ['', 'apps/sub/app1', 'apps/sub/app1'],
      ['', './apps/echo', 'apps/echo'],
      ['', 'echo', 'echo'],
    ])('rootDir="%s", appPath="%s" -> "%s"', (rootDir, appPath, expected) => {
      expect(extractAppLabel(appPath, rootDir)).toBe(expected);
    });
  });

  describe('with current directory rootDir', () => {
    test.each([
      ['.', 'apps/echo', 'apps/echo'],
      ['.', './apps/echo', 'apps/echo'],
      ['./', 'apps/echo', 'apps/echo'],
      ['./', './apps/echo', 'apps/echo'],
      ['.', 'echo', 'echo'],
      ['./', 'echo', 'echo'],
    ])('rootDir="%s", appPath="%s" -> "%s"', (rootDir, appPath, expected) => {
      expect(extractAppLabel(appPath, rootDir)).toBe(expected);
    });
  });

  describe('with apps rootDir', () => {
    test.each([
      ['apps', 'apps/echo', 'echo'],
      ['./apps', 'apps/echo', 'echo'],
      ['./apps/', 'apps/echo', 'echo'],
      ['apps/', 'apps/echo', 'echo'],
      ['apps', 'apps/sub/app1', 'sub/app1'],
      ['./apps', 'apps/sub/app1', 'sub/app1'],
      ['./apps/', 'apps/sub/app1', 'sub/app1'],
    ])('rootDir="%s", appPath="%s" -> "%s"', (rootDir, appPath, expected) => {
      expect(extractAppLabel(appPath, rootDir)).toBe(expected);
    });
  });

  describe('with nested rootDir', () => {
    test.each([
      ['apps/sub', 'apps/sub/app1', 'app1'],
      ['./apps/sub', 'apps/sub/app1', 'app1'],
      ['./apps/sub/', 'apps/sub/app1', 'app1'],
      ['apps/sub/', 'apps/sub/app1', 'app1'],
      ['apps/sub', 'apps/sub/deeper/app2', 'deeper/app2'],
    ])('rootDir="%s", appPath="%s" -> "%s"', (rootDir, appPath, expected) => {
      expect(extractAppLabel(appPath, rootDir)).toBe(expected);
    });
  });

  describe('when appPath does not start with rootDir', () => {
    test.each([
      ['services', 'apps/echo'],
      ['./services', 'apps/echo'],
      ['apps/sub', 'apps/other/app1'],
    ])('rootDir="%s", appPath="%s" throws error', (rootDir, appPath) => {
      expect(() => extractAppLabel(appPath, rootDir)).toThrow(
        `appPath "${appPath}" is outside of rootDir "${rootDir}". All app paths must be within the root directory.`,
      );
    });
  });
});

describe('resolvePath', () => {
  describe('with $repoRoot/ prefix (repository root)', () => {
    test.each([
      ['$repoRoot/apps/shared/lib', 'apps/web', 'apps/shared/lib'],
      ['$repoRoot/packages/common', 'apps/api/src', 'packages/common'],
      ['$repoRoot/libs', 'deeply/nested/app', 'libs'],
    ])('resolvePath("%s", "%s") -> "%s"', (inputPath, appPath, expected) => {
      expect(resolvePath(inputPath, appPath)).toBe(expected);
    });
  });

  describe('with relative paths (from appPath)', () => {
    test.each([
      ['../..', 'apps/example/subapp', 'apps'],
      ['../', 'apps/hello-world', 'apps'],
      ['Dockerfile', 'apps/web', 'apps/web/Dockerfile'],
      ['./Dockerfile', 'apps/web', 'apps/web/Dockerfile'],
      ['config/app.yaml', 'apps/api', 'apps/api/config/app.yaml'],
      ['../../shared', 'apps/mono/apps/web', 'apps/mono/shared'],
    ])('resolvePath("%s", "%s") -> "%s"', (inputPath, appPath, expected) => {
      expect(resolvePath(inputPath, appPath)).toBe(expected);
    });
  });

  describe('trailing slash removal', () => {
    test.each([
      ['../', 'apps/web', 'apps'],
      ['../../', 'apps/mono/web', 'apps'],
    ])(
      'resolvePath("%s", "%s") -> "%s" (no trailing slash)',
      (inputPath, appPath, expected) => {
        expect(resolvePath(inputPath, appPath)).toBe(expected);
      },
    );
  });
});

describe('createUnresolvedPath', () => {
  it('creates an unresolved path with $repoRoot/ spec', () => {
    const result = createUnresolvedPath('/repo/apps/web', '$repoRoot/libs');

    expect(result).toEqual({
      type: 'unresolved',
      basePath: '/repo/apps/web',
      spec: '$repoRoot/libs',
    });
  });

  it('creates an unresolved path with relative spec', () => {
    const result = createUnresolvedPath('/repo/apps/web', '../shared');

    expect(result).toEqual({
      type: 'unresolved',
      basePath: '/repo/apps/web',
      spec: '../shared',
    });
  });
});

describe('resolveToAbsolutePath', () => {
  describe('with $repoRoot/ prefix', () => {
    it('resolves $repoRoot/ path from repository root', () => {
      const unresolved = createUnresolvedPath(
        '/repo/apps/web',
        '$repoRoot/libs',
      );
      const result = resolveToAbsolutePath(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '$repoRoot/libs',
        absolutePath: '/repo/libs',
        relativePath: 'libs',
      });
    });

    it('resolves nested $repoRoot/ path', () => {
      const unresolved = createUnresolvedPath(
        '/repo/apps/web',
        '$repoRoot/packages/shared/utils',
      );
      const result = resolveToAbsolutePath(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '$repoRoot/packages/shared/utils',
        absolutePath: '/repo/packages/shared/utils',
        relativePath: 'packages/shared/utils',
      });
    });
  });

  describe('with relative paths', () => {
    it('resolves relative path from basePath', () => {
      const unresolved = createUnresolvedPath('/repo/apps/web', '../shared');
      const result = resolveToAbsolutePath(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '../shared',
        absolutePath: '/repo/apps/shared',
        relativePath: 'apps/shared',
      });
    });

    it('resolves deeply nested relative path', () => {
      const unresolved = createUnresolvedPath(
        '/repo/apps/mono/apps/web',
        '../../packages/common',
      );
      const result = resolveToAbsolutePath(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/mono/apps/web',
        spec: '../../packages/common',
        absolutePath: '/repo/apps/mono/packages/common',
        relativePath: 'apps/mono/packages/common',
      });
    });

    it('resolves sibling directory path', () => {
      const unresolved = createUnresolvedPath('/repo/apps/web', './lib');
      const result = resolveToAbsolutePath(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: './lib',
        absolutePath: '/repo/apps/web/lib',
        relativePath: 'apps/web/lib',
      });
    });
  });
});

describe('jobs JSON I/O', () => {
  const createTempDir = () => mkdtempSync(join(tmpdir(), 'monotonix-test-'));

  const createCore = () => ({
    outputs: new Map<string, unknown>(),
    exports: new Map<string, unknown>(),
    warnings: [] as string[],
    setOutput(name: string, value: unknown) {
      this.outputs.set(name, value);
    },
    exportVariable(name: string, value: unknown) {
      this.exports.set(name, value);
    },
    warning(message: string) {
      this.warnings.push(message);
    },
  });

  it('writes large results to a file without exporting MONOTONIX_JOBS', () => {
    const tempDir = createTempDir();
    try {
      const core = createCore();
      const result = [{ value: 'x'.repeat(33 * 1024) }];

      const resultFile = publishJobsResult({
        result,
        core,
        env: { RUNNER_TEMP: tempDir },
      });

      const resultJson = JSON.stringify(result);
      expect(readFileSync(resultFile, 'utf8')).toBe(resultJson);
      expect(core.outputs.get('result')).toBe(resultJson);
      expect(core.outputs.get('result-file')).toBe(resultFile);
      expect(core.exports.get(MONOTONIX_JOBS_FILE_ENV)).toBe(resultFile);
      expect(core.exports.has(MONOTONIX_JOBS_ENV)).toBe(false);
      expect(core.warnings).toEqual([
        expect.stringContaining(`Skipping ${MONOTONIX_JOBS_ENV} export`),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps legacy MONOTONIX_JOBS export for small results', () => {
    const tempDir = createTempDir();
    try {
      const core = createCore();
      const result = [{ value: 'small' }];

      publishJobsResult({
        result,
        core,
        env: { RUNNER_TEMP: tempDir },
      });

      expect(core.exports.get(MONOTONIX_JOBS_ENV)).toBe(JSON.stringify(result));
      expect(core.exports.has(MONOTONIX_JOBS_FILE_ENV)).toBe(true);
      expect(core.warnings).toEqual([
        expect.stringContaining(`${MONOTONIX_JOBS_ENV} is deprecated`),
      ]);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('reads jobs by explicit input, explicit file, env file, then legacy env', () => {
    const tempDir = createTempDir();
    try {
      const explicitFile = join(tempDir, 'explicit.json');
      const envFile = join(tempDir, 'env.json');
      writeFileSync(explicitFile, 'from-explicit-file', 'utf8');
      writeFileSync(envFile, 'from-env-file', 'utf8');

      expect(
        readJobsJsonInput({
          jobs: 'from-input',
          jobsFile: explicitFile,
          env: {
            [MONOTONIX_JOBS_FILE_ENV]: envFile,
            [MONOTONIX_JOBS_ENV]: 'from-env',
          },
        }),
      ).toBe('from-input');

      expect(
        readJobsJsonInput({
          jobsFile: explicitFile,
          env: {
            [MONOTONIX_JOBS_FILE_ENV]: envFile,
            [MONOTONIX_JOBS_ENV]: 'from-env',
          },
        }),
      ).toBe('from-explicit-file');

      expect(
        readJobsJsonInput({
          env: {
            [MONOTONIX_JOBS_FILE_ENV]: envFile,
            [MONOTONIX_JOBS_ENV]: 'from-env',
          },
        }),
      ).toBe('from-env-file');

      expect(
        readJobsJsonInput({
          env: {
            [MONOTONIX_JOBS_ENV]: 'from-env',
          },
        }),
      ).toBe('from-env');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
