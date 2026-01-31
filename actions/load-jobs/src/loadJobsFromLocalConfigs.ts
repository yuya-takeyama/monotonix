import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  Job,
  Jobs,
  LocalConfig,
  LocalConfigJob,
  LocalConfigSchema,
} from '@monotonix/schema';
import { extractAppLabel, resolvePath } from '@monotonix/utils';
import { globSync } from 'glob';
import { load } from 'js-yaml';
import { CommitInfo, getLastCommit } from './getLastCommit';
import { Event } from './schema';

const ROOT_PREFIX = '$root/';

/**
 * Resolves a dependency path to an absolute filesystem path.
 * - $root/ prefix paths are resolved from rootDir
 * - Relative paths are resolved from appPath
 */
const resolveDependencyPath = (
  dep: string,
  appPath: string,
  rootDir: string,
): string => {
  const resolved = resolvePath(dep, appPath);
  // $root/ paths return relative paths from repository root, so join with rootDir
  if (dep.startsWith(ROOT_PREFIX)) {
    return join(rootDir, resolved);
  }
  return resolved;
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
        // Use already resolved dependency paths
        const resolvedDeps = resolvedDepsMap.get(appPath) || [];
        const resolvedDepPaths = resolvedDeps.map(d => d.resolved);

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

type ResolvedDependency = {
  original: string;
  resolved: string;
};

const validateDependencies = (
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
): Map<string, ResolvedDependency[]> => {
  // Phase 1: Resolve all dependency paths
  const resolvedDepsMap = new Map<string, ResolvedDependency[]>();

  for (const [appPath, config] of allConfigs) {
    const dependencies = config.app?.depends_on || [];
    const resolvedDeps = dependencies.map(dep => ({
      original: dep,
      resolved: resolveDependencyPath(dep, appPath, rootDir),
    }));
    resolvedDepsMap.set(appPath, resolvedDeps);
  }

  // Phase 2: Validate each resolved path (existence check + self-dependency check)
  for (const [appPath, resolvedDeps] of resolvedDepsMap) {
    const appLabel = extractAppLabel(appPath, rootDir);

    for (const { original, resolved } of resolvedDeps) {
      if (resolved === appPath) {
        throw new Error(
          `Self-dependency detected: "${appLabel}" cannot depend on itself`,
        );
      }

      if (!existsSync(resolved)) {
        throw new Error(
          `Dependency "${original}" does not exist (required by "${appLabel}")`,
        );
      }
    }
  }

  // Phase 3: Detect circular dependencies
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
    for (const { resolved } of resolvedDeps) {
      if (
        hasCircularDependency(
          resolved,
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
