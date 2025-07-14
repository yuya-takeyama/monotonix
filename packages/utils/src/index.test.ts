import { extractAppLabel } from './index';

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
      ['services', 'apps/echo', 'apps/echo'],
      ['./services', 'apps/echo', 'apps/echo'],
      ['apps/sub', 'apps/other/app1', 'apps/other/app1'],
    ])('rootDir="%s", appPath="%s" -> "%s"', (rootDir, appPath, expected) => {
      expect(extractAppLabel(appPath, rootDir)).toBe(expected);
    });
  });
});
