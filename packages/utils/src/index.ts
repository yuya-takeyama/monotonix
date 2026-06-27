import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, normalize, relative } from 'path';

/**
 * Prefix for paths resolved from repository root.
 * Example: "$repoRoot/apps/shared" resolves to "apps/shared" from repo root.
 */
export const REPO_ROOT_PREFIX = '$repoRoot/';

/**
 * Unresolved path - contains the original spec from config.
 * Must be resolved before use in filesystem operations.
 */
export type UnresolvedPath = {
  type: 'unresolved';
  basePath: string; // The base path for resolution (e.g., app directory)
  spec: string; // Original spec from config (e.g., "$repoRoot/libs", "../shared")
};

/**
 * Resolved path - contains both absolute and relative paths.
 * - absolutePath: Safe to use in filesystem operations like existsSync
 * - relativePath: Relative to repository root, for comparing with GitHub changed files
 */
export type ResolvedPath = {
  type: 'resolved';
  basePath: string; // The base path used for resolution
  spec: string; // Original spec for error messages
  absolutePath: string; // Resolved absolute filesystem path
  relativePath: string; // Relative path from repository root
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
 * - Paths starting with "$repoRoot/" are resolved from repository root
 * - All other paths are resolved relative to appPath
 *
 * @param inputPath - The path to resolve (e.g., "../..", "$repoRoot/apps/shared")
 * @param appPath - The base path for relative resolution
 * @returns The resolved path (relative for $repoRoot/, absolute for relative paths)
 */
export const resolvePath = (inputPath: string, appPath: string): string => {
  if (inputPath.startsWith(REPO_ROOT_PREFIX)) {
    return inputPath.slice(REPO_ROOT_PREFIX.length);
  }
  return join(appPath, inputPath).replace(/\/$/, '');
};

/**
 * Resolves an unresolved path to an absolute filesystem path.
 * - $repoRoot/ prefix paths are resolved from repositoryRoot
 * - Relative paths are resolved from basePath
 *
 * @param unresolved - The unresolved path to resolve
 * @param repositoryRoot - The absolute path to the repository root (e.g., GITHUB_WORKSPACE)
 */
export const resolveToAbsolutePath = (
  unresolved: UnresolvedPath,
  repositoryRoot: string,
): ResolvedPath => {
  const resolved = resolvePath(unresolved.spec, unresolved.basePath);
  // $repoRoot/ paths return relative paths from repository root, so join with repositoryRoot
  const absolutePath = unresolved.spec.startsWith(REPO_ROOT_PREFIX)
    ? join(repositoryRoot, resolved)
    : resolved;

  // Calculate relative path from repository root
  const relativePath = relative(repositoryRoot, absolutePath);

  return {
    type: 'resolved',
    basePath: unresolved.basePath,
    spec: unresolved.spec,
    absolutePath,
    relativePath,
  };
};

export const MONOTONIX_JOBS_ENV = 'MONOTONIX_JOBS';
export const MONOTONIX_JOBS_FILE_ENV = 'MONOTONIX_JOBS_FILE';
export const MONOTONIX_JOBS_LEGACY_ENV_LIMIT_BYTES = 32 * 1024;

type JobsJsonInputParams = {
  jobs?: string;
  jobsFile?: string;
  env?: NodeJS.ProcessEnv;
};

export const readJobsJsonInput = ({
  jobs,
  jobsFile,
  env = process.env,
}: JobsJsonInputParams): string | undefined => {
  if (jobs) {
    return jobs;
  }

  const inputFile = jobsFile || env[MONOTONIX_JOBS_FILE_ENV];
  if (inputFile) {
    return readFileSync(inputFile, 'utf8');
  }

  return env[MONOTONIX_JOBS_ENV];
};

type ActionCore = {
  setOutput: (name: string, value: unknown) => void;
  exportVariable: (name: string, value: unknown) => void;
  warning: (message: string) => void;
};

type PublishJobsResultParams = {
  result: unknown;
  core: ActionCore;
  env?: NodeJS.ProcessEnv;
};

export const publishJobsResult = ({
  result,
  core,
  env = process.env,
}: PublishJobsResultParams): string => {
  const resultJson =
    typeof result === 'string' ? result : JSON.stringify(result);
  const resultFile = writeJobsResultFile(resultJson, env);

  core.setOutput('result', resultJson);
  core.setOutput('result-file', resultFile);
  core.exportVariable(MONOTONIX_JOBS_FILE_ENV, resultFile);

  if (
    Buffer.byteLength(resultJson, 'utf8') <=
    MONOTONIX_JOBS_LEGACY_ENV_LIMIT_BYTES
  ) {
    core.warning(
      `${MONOTONIX_JOBS_ENV} is deprecated. Use ${MONOTONIX_JOBS_FILE_ENV} or the result-file output for action-to-action jobs handoff.`,
    );
    core.exportVariable(MONOTONIX_JOBS_ENV, resultJson);
  } else {
    core.warning(
      `Skipping ${MONOTONIX_JOBS_ENV} export because the jobs payload exceeds ${MONOTONIX_JOBS_LEGACY_ENV_LIMIT_BYTES} bytes. Use ${MONOTONIX_JOBS_FILE_ENV} or the result-file output instead.`,
    );
  }

  return resultFile;
};

const writeJobsResultFile = (
  resultJson: string,
  env: NodeJS.ProcessEnv,
): string => {
  const baseDir = env.RUNNER_TEMP || tmpdir();
  const resultDir = join(baseDir, 'monotonix');
  mkdirSync(resultDir, { recursive: true });

  const fileName = `jobs-${process.pid}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.json`;
  const resultFile = join(resultDir, fileName);
  writeFileSync(resultFile, resultJson, 'utf8');
  return resultFile;
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
