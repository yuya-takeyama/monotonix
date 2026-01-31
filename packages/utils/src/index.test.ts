import {
  createUnresolvedPath,
  extractAppLabel,
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
  describe('with $root/ prefix (repository root)', () => {
    test.each([
      ['$root/apps/shared/lib', 'apps/web', 'apps/shared/lib'],
      ['$root/packages/common', 'apps/api/src', 'packages/common'],
      ['$root/libs', 'deeply/nested/app', 'libs'],
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
  it('creates an unresolved path with $root/ spec', () => {
    const result = createUnresolvedPath('/repo/apps/web', '$root/libs');

    expect(result).toEqual({
      type: 'unresolved',
      basePath: '/repo/apps/web',
      spec: '$root/libs',
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
  describe('with $root/ prefix', () => {
    it('resolves $root/ path from repository root', () => {
      const unresolved = createUnresolvedPath('/repo/apps/web', '$root/libs');
      const result = resolveToAbsolutePath(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '$root/libs',
        absolutePath: '/repo/libs',
      });
    });

    it('resolves nested $root/ path', () => {
      const unresolved = createUnresolvedPath(
        '/repo/apps/web',
        '$root/packages/shared/utils',
      );
      const result = resolveToAbsolutePath(unresolved, '/repo');

      expect(result).toEqual({
        type: 'resolved',
        basePath: '/repo/apps/web',
        spec: '$root/packages/shared/utils',
        absolutePath: '/repo/packages/shared/utils',
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
      });
    });
  });
});
