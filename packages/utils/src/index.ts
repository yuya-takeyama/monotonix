import { join, normalize, relative } from 'path';

/**
 * Prefix for paths resolved from repository root.
 * Example: "$root/apps/shared" resolves to "apps/shared" from repo root.
 */
export const ROOT_PREFIX = '$root/';

/**
 * Unresolved path - contains the original spec from config.
 * Must be resolved before use in filesystem operations.
 */
export type UnresolvedPath = {
  type: 'unresolved';
  basePath: string; // The base path for resolution (e.g., app directory)
  spec: string; // Original spec from config (e.g., "$root/libs", "../shared")
};

/**
 * Resolved path - contains the absolute filesystem path.
 * Safe to use in filesystem operations like existsSync.
 */
export type ResolvedPath = {
  type: 'resolved';
  basePath: string; // The base path used for resolution
  spec: string; // Original spec for error messages
  absolutePath: string; // Resolved absolute filesystem path
};

/**
 * Creates an unresolved path from config.
 */
export const createUnresolvedPath = (
  basePath: string,
  spec: string,
): UnresolvedPath => ({
  type: 'unresolved',
  basePath,
  spec,
});

/**
 * Resolves a path based on its format:
 * - Paths starting with "$root/" are resolved from repository root
 * - All other paths are resolved relative to appPath
 *
 * @param inputPath - The path to resolve (e.g., "../..", "$root/apps/shared")
 * @param appPath - The base path for relative resolution
 * @returns The resolved path (relative for $root/, absolute for relative paths)
 */
export const resolvePath = (inputPath: string, appPath: string): string => {
  if (inputPath.startsWith(ROOT_PREFIX)) {
    return inputPath.slice(ROOT_PREFIX.length);
  }
  return join(appPath, inputPath).replace(/\/$/, '');
};

/**
 * Resolves an unresolved path to an absolute filesystem path.
 * - $root/ prefix paths are resolved from rootDir
 * - Relative paths are resolved from basePath
 */
export const resolveToAbsolutePath = (
  unresolved: UnresolvedPath,
  rootDir: string,
): ResolvedPath => {
  const resolved = resolvePath(unresolved.spec, unresolved.basePath);
  // $root/ paths return relative paths from repository root, so join with rootDir
  const absolutePath = unresolved.spec.startsWith(ROOT_PREFIX)
    ? join(rootDir, resolved)
    : resolved;

  return {
    type: 'resolved',
    basePath: unresolved.basePath,
    spec: unresolved.spec,
    absolutePath,
  };
};

export const extractAppLabel = (appPath: string, rootDir: string): string => {
  // Normalize both paths to handle various input formats
  const normalizedRootDir = normalize(rootDir || '.');
  const normalizedAppPath = normalize(appPath);

  // Calculate relative path
  const relativePath = relative(normalizedRootDir, normalizedAppPath);

  // If the relative path starts with '..', it means appPath is outside rootDir
  // This is likely a configuration error
  if (relativePath.startsWith('..')) {
    throw new Error(
      `appPath "${appPath}" is outside of rootDir "${rootDir}". ` +
        `All app paths must be within the root directory.`,
    );
  }

  return relativePath;
};
