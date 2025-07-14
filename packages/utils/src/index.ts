export const extractAppLabel = (appPath: string, rootDir: string): string => {
  // Normalize rootDir to handle various input formats
  // Convert empty string to current directory
  const normalizedRootDir = rootDir === '' ? '.' : rootDir;

  // Remove trailing slashes from rootDir
  let cleanRootDir = normalizedRootDir.replace(/\/+$/, '');

  // If rootDir is '.' or './', handle it specially
  if (cleanRootDir === '.' || cleanRootDir === './') {
    // appPath should be relative to current directory
    return appPath.startsWith('./') ? appPath.slice(2) : appPath;
  }

  // Remove leading ./ from rootDir
  if (cleanRootDir.startsWith('./')) {
    cleanRootDir = cleanRootDir.slice(2);
  }

  // Check if appPath starts with the rootDir
  if (appPath.startsWith(cleanRootDir)) {
    const relative = appPath.slice(cleanRootDir.length);
    // Remove leading slashes from the relative path
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }

  // If rootDir is not a prefix of appPath, return appPath as is
  return appPath;
};
