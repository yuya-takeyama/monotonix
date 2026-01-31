import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  Job,
  Jobs,
  LocalConfig,
  LocalConfigJob,
  LocalConfigSchema,
} from '@monotonix/schema';
import { extractAppLabel, ROOT_PREFIX, resolvePath } from '@monotonix/utils';
import { globSync } from 'glob';
import { load } from 'js-yaml';
import { CommitInfo, getLastCommit } from './getLastCommit';
import { Event } from './schema';

/**
 * Unresolved dependency - contains the original spec from config.
 * Must be resolved before use in filesystem operations.
 */
export type UnresolvedDependency = {
  type: 'unresolved';
  appPath: string; // The app that declares this dependency
  spec: string; // Original spec from config (e.g., "$root/libs", "../shared")
};

/**
 * Resolved dependency - contains the absolute filesystem path.
 * Safe to use in filesystem operations like existsSync.
 */
export type ResolvedDependency = {
  type: 'resolved';
  appPath: string; // The app that declares this dependency
  spec: string; // Original spec for error messages
  absolutePath: string; // Resolved absolute filesystem path
};

/**
 * Creates an unresolved dependency from config.
 */
export const createUnresolvedDependency = (
  appPath: string,
  spec: string,
): UnresolvedDependency => ({
  type: 'unresolved',
  appPath,
  spec,
});

/**
 * Resolves a dependency to an absolute filesystem path.
 * - $root/ prefix paths are resolved from rootDir
 * - Relative paths are resolved from appPath
 */
export const resolveDependency = (
  dep: UnresolvedDependency,
  rootDir: string,
): ResolvedDependency => {
  const resolved = resolvePath(dep.spec, dep.appPath);
  // $root/ paths return relative paths from repository root, so join with rootDir
  const absolutePath = dep.spec.startsWith(ROOT_PREFIX)
    ? join(rootDir, resolved)
    : resolved;

  return {
    type: 'resolved',
    appPath: dep.appPath,
    spec: dep.spec,
    absolutePath,
  };
};

type LoadJobsFromLocalConfigFilesOptions = {
  rootDir: string;
  dedupeKey: string;
  requiredConfigKeys: string[];
  localConfigFileName: string;
  event: Event;
};

export const loadJobsFromLocalConfigFiles = async ({
  rootDir,
  dedupeKey,
  requiredConfigKeys,
  localConfigFileName,
  event,
}: LoadJobsFromLocalConfigFilesOptions): Promise<Jobs> => {
  const allConfigs = await loadAllLocalConfigs(rootDir, localConfigFileName);

  const resolvedDepsMap = validateDependencies(allConfigs, rootDir);

  const jobs = await createJobsFromConfigs(allConfigs, resolvedDepsMap, {
    dedupeKey,
    event,
    rootDir,
    localConfigFileName,
  });

  return jobs
    .flat()
    .filter(job => requiredConfigKeys.every(key => key in job.configs));
};

const loadAllLocalConfigs = async (
  rootDir: string,
  localConfigFileName: string,
): Promise<Map<string, LocalConfig>> => {
  const pattern = join(rootDir, '**', localConfigFileName);
  const localConfigPaths = globSync(pattern);
  const allConfigs = new Map<string, LocalConfig>();

  for (const localConfigPath of localConfigPaths) {
    try {
      const localConfigContent = readFileSync(localConfigPath, 'utf-8');
      const localConfig = LocalConfigSchema.parse(load(localConfigContent));
      allConfigs.set(dirname(localConfigPath), localConfig);
    } catch (err) {
      throw new Error(
        `Failed to parse ${localConfigPath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return allConfigs;
};

type JobCreationContext = {
  dedupeKey: string;
  event: Event;
  rootDir: string;
  localConfigFileName: string;
};

const createJobsFromConfigs = async (
  allConfigs: Map<string, LocalConfig>,
  resolvedDepsMap: Map<string, ResolvedDependency[]>,
  context: JobCreationContext,
): Promise<Job[][]> => {
  return Promise.all(
    Array.from(allConfigs.entries()).map(async ([appPath, localConfig]) => {
      try {
        // Use already resolved dependency paths (type-safe)
        const resolvedDeps = resolvedDepsMap.get(appPath) || [];
        const resolvedDepPaths = resolvedDeps.map(d => d.absolutePath);

        const lastCommit = await calculateEffectiveTimestamp(
          appPath,
          resolvedDepPaths,
        );

        return Object.entries(localConfig.jobs).map(
          ([jobKey, job]): Job =>
            createJob({
              localConfig,
              appPath,
              lastCommit,
              jobKey,
              job,
              ...context,
            }),
        );
      } catch (err) {
        const configPath = join(appPath, context.localConfigFileName);
        throw new Error(
          `Failed to process ${configPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }),
  );
};

type CreateJobOptions = {
  localConfig: LocalConfig;
  dedupeKey: string;
  appPath: string;
  lastCommit: CommitInfo;
  jobKey: string;
  job: LocalConfigJob;
  event: Event;
  rootDir: string;
};

export const createJob = ({
  localConfig,
  dedupeKey,
  appPath,
  lastCommit,
  jobKey,
  job,
  event,
  rootDir,
}: CreateJobOptions): Job => ({
  ...job,
  app: localConfig.app,
  context: {
    dedupe_key: dedupeKey,
    github_ref: event.ref,
    app_path: appPath,
    root_dir: rootDir,
    job_key: jobKey,
    last_commit: lastCommit,
    label: `${extractAppLabel(appPath, rootDir)} / ${jobKey}`,
  },
  params: {},
  metadata: job.metadata, // Propagate job metadata from job definition
});

export const calculateEffectiveTimestamp = async (
  appPath: string,
  resolvedDependencies: string[],
): Promise<CommitInfo> => {
  const appCommit = await getLastCommit(appPath);

  // Skip if no dependencies
  if (resolvedDependencies.length === 0) {
    return appCommit;
  }

  // Get commit info for all dependencies in parallel
  // Note: Dependencies are already validated (existence check) in validateDependencies
  const dependencyCommits = await Promise.all(
    resolvedDependencies
      .filter(dep => dep !== appPath) // Skip self-dependency
      .map(dep => getLastCommit(dep)),
  );

  // Find the most recent commit among app and all dependencies
  const allCommits = [appCommit, ...dependencyCommits];
  const maxTimestamp = Math.max(...allCommits.map(c => c.timestamp));

  return (
    allCommits.find(commit => commit.timestamp === maxTimestamp) || appCommit
  );
};

/**
 * Validates all dependency paths in the given configs.
 *
 * Validation phases:
 * 1. Create unresolved dependencies from config
 * 2. Resolve all dependency paths to absolute filesystem paths
 * 3. Validate existence + self-dependency check
 * 4. Detect circular dependencies
 *
 * @throws Error if any dependency path is invalid
 */
export const validateDependencies = (
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
): Map<string, ResolvedDependency[]> => {
  // Phase 1: Create unresolved dependencies from config
  const unresolvedDepsMap = new Map<string, UnresolvedDependency[]>();

  for (const [appPath, config] of allConfigs) {
    const dependencies = config.app?.depends_on || [];
    const unresolvedDeps = dependencies.map(spec =>
      createUnresolvedDependency(appPath, spec),
    );
    unresolvedDepsMap.set(appPath, unresolvedDeps);
  }

  // Phase 2: Resolve all dependency paths
  const resolvedDepsMap = new Map<string, ResolvedDependency[]>();

  for (const [appPath, unresolvedDeps] of unresolvedDepsMap) {
    const resolvedDeps = unresolvedDeps.map(dep =>
      resolveDependency(dep, rootDir),
    );
    resolvedDepsMap.set(appPath, resolvedDeps);
  }

  // Phase 3: Validate each resolved path (existence check + self-dependency check)
  for (const [appPath, resolvedDeps] of resolvedDepsMap) {
    const appLabel = extractAppLabel(appPath, rootDir);

    for (const dep of resolvedDeps) {
      if (dep.absolutePath === appPath) {
        throw new Error(
          `Self-dependency detected: "${appLabel}" cannot depend on itself`,
        );
      }

      if (!existsSync(dep.absolutePath)) {
        throw new Error(
          `Dependency "${dep.spec}" does not exist (required by "${appLabel}")`,
        );
      }
    }
  }

  // Phase 4: Detect circular dependencies
  detectCircularDependencies(allConfigs, rootDir, resolvedDepsMap);

  return resolvedDepsMap;
};

const detectCircularDependencies = (
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
  resolvedDepsMap: Map<string, ResolvedDependency[]>,
): void => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const [appPath] of allConfigs) {
    if (
      hasCircularDependency(appPath, resolvedDepsMap, visited, recursionStack)
    ) {
      const appLabel = extractAppLabel(appPath, rootDir);
      throw new Error(`Circular dependency detected involving "${appLabel}"`);
    }
  }
};

const hasCircularDependency = (
  appPath: string,
  resolvedDepsMap: Map<string, ResolvedDependency[]>,
  visited: Set<string>,
  recursionStack: Set<string>,
): boolean => {
  if (recursionStack.has(appPath)) {
    return true;
  }

  if (visited.has(appPath)) {
    return false;
  }

  visited.add(appPath);
  recursionStack.add(appPath);

  const resolvedDeps = resolvedDepsMap.get(appPath);
  if (resolvedDeps) {
    for (const dep of resolvedDeps) {
      if (
        hasCircularDependency(
          dep.absolutePath,
          resolvedDepsMap,
          visited,
          recursionStack,
        )
      ) {
        return true;
      }
    }
  }

  recursionStack.delete(appPath);
  return false;
};
