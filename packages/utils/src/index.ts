import { normalize, relative } from 'path';

export const extractAppLabel = (appPath: string, rootDir: string): string => {
  // Normalize both paths to handle various input formats
  const normalizedRootDir = normalize(rootDir || '.');
  const normalizedAppPath = normalize(appPath);

  // Calculate relative path
  const relativePath = relative(normalizedRootDir, normalizedAppPath);

  // If the relative path starts with '..', it means appPath is outside rootDir
  // In this case, return the original appPath
  if (relativePath.startsWith('..')) {
    return normalizedAppPath;
  }

  return relativePath;
};
