import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  Job,
  Jobs,
  LocalConfig,
  LocalConfigJob,
  LocalConfigSchema,
} from '@monotonix/schema';
import { extractAppLabel } from '@monotonix/utils';
import { globSync } from 'glob';
import { load } from 'js-yaml';
import { CommitInfo, getLastCommit } from './getLastCommit';
import { Event } from './schema';

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

  validateDependencies(allConfigs, rootDir);

  const jobs = await createJobsFromConfigs(allConfigs, {
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
  context: JobCreationContext,
): Promise<Job[][]> => {
  return Promise.all(
    Array.from(allConfigs.entries()).map(async ([appPath, localConfig]) => {
      try {
        const lastCommit = await calculateEffectiveTimestamp(
          appPath,
          localConfig.app?.depends_on || [],
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
  app: localConfig.app || { depends_on: [] },
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
  dependencies: string[],
): Promise<CommitInfo> => {
  const appCommit = await getLastCommit(appPath);

  // Skip if no dependencies
  if (dependencies.length === 0) {
    return appCommit;
  }

  // Get commit info for all dependencies in parallel
  const dependencyCommits = await Promise.all(
    dependencies
      .filter(dep => dep !== appPath) // Skip self-dependency
      .map(async dep => {
        if (!existsSync(dep)) {
          throw new Error(`Dependency path does not exist: ${dep}`);
        }
        return getLastCommit(dep);
      }),
  );

  // Find the most recent commit among app and all dependencies
  const allCommits = [appCommit, ...dependencyCommits];
  const maxTimestamp = Math.max(...allCommits.map(c => c.timestamp));

  return (
    allCommits.find(commit => commit.timestamp === maxTimestamp) || appCommit
  );
};

const validateDependencies = (
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
): void => {
  // First pass: validate individual dependencies
  for (const [appPath, config] of allConfigs) {
    const appLabel = extractAppLabel(appPath, rootDir);
    const dependencies = config.app?.depends_on || [];

    for (const dep of dependencies) {
      if (dep === appPath) {
        throw new Error(
          `Self-dependency detected: "${appLabel}" cannot depend on itself`,
        );
      }

      if (!existsSync(dep)) {
        throw new Error(
          `Dependency "${dep}" does not exist (required by "${appLabel}")`,
        );
      }
    }
  }

  // Second pass: detect circular dependencies
  detectCircularDependencies(allConfigs, rootDir);
};

const detectCircularDependencies = (
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
): void => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const [appPath] of allConfigs) {
    if (hasCircularDependency(appPath, allConfigs, visited, recursionStack)) {
      const appLabel = extractAppLabel(appPath, rootDir);
      throw new Error(`Circular dependency detected involving "${appLabel}"`);
    }
  }
};

const hasCircularDependency = (
  appPath: string,
  allConfigs: Map<string, LocalConfig>,
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

  const config = allConfigs.get(appPath);
  if (config) {
    const dependencies = config.app?.depends_on || [];

    for (const dep of dependencies) {
      if (hasCircularDependency(dep, allConfigs, visited, recursionStack)) {
        return true;
      }
    }
  }

  recursionStack.delete(appPath);
  return false;
};
