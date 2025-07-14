import { normalize, relative } from 'path';

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
