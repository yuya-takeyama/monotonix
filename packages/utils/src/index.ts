import { join, normalize, relative } from 'path';

const ROOT_PREFIX = '$root/';

/**
 * Resolves a path based on its format:
 * - Paths starting with "$root/" are resolved from repository root
 * - All other paths are resolved relative to appPath
 *
 * @param inputPath - The path to resolve (e.g., "../..", "$root/apps/shared")
 * @param appPath - The base path for relative resolution
 * @returns The resolved path
 */
export const resolvePath = (inputPath: string, appPath: string): string => {
  if (inputPath.startsWith(ROOT_PREFIX)) {
    return inputPath.slice(ROOT_PREFIX.length);
  }
  return join(appPath, inputPath).replace(/\/$/, '');
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
