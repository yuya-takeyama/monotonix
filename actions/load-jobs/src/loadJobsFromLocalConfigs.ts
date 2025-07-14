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

type loadJobsFromLocalConfigFilesParams = {
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
}: loadJobsFromLocalConfigFilesParams): Promise<Jobs> => {
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
        `Failed to load local config: ${localConfigPath}: ${err}`,
      );
    }
  }

  validateDependencies(allConfigs, rootDir);

  const jobs = await Promise.all(
    Array.from(allConfigs.entries()).map(async ([appPath, localConfig]) => {
      try {
        const lastCommit = await calculateEffectiveTimestamp(
          appPath,
          localConfig.app.depends_on,
          rootDir,
        );

        return Object.entries(localConfig.jobs).map(
          ([jobKey, job]): Job =>
            createJob({
              localConfig,
              dedupeKey,
              appPath,
              lastCommit,
              jobKey,
              job,
              event,
              rootDir,
            }),
        );
      } catch (err) {
        throw new Error(
          `Failed to load local config: ${join(appPath, localConfigFileName)}: ${err}`,
        );
      }
    }),
  );

  return jobs
    .flat()
    .filter(job => requiredConfigKeys.every(key => key in job.configs));
};

type createJobParams = {
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
}: createJobParams): Job => ({
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
});

export const calculateEffectiveTimestamp = async (
  appPath: string,
  dependencies: string[],
  _rootDir: string,
): Promise<CommitInfo> => {
  const appCommit = await getLastCommit(appPath);
  const timestamps: number[] = [appCommit.timestamp];
  const commitInfos: CommitInfo[] = [appCommit];

  for (const dep of dependencies) {
    if (dep === appPath) {
      continue;
    }

    // Dependencies now include root-dir
    if (!existsSync(dep)) {
      throw new Error(`Dependency path does not exist: ${dep}`);
    }

    const depCommit = await getLastCommit(dep);
    timestamps.push(depCommit.timestamp);
    commitInfos.push(depCommit);
  }

  const maxTimestamp = Math.max(...timestamps);
  const maxCommitInfo = commitInfos.find(
    commit => commit.timestamp === maxTimestamp,
  );

  return maxCommitInfo || appCommit;
};

const validateDependencies = (
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
): void => {
  for (const [appPath, config] of allConfigs) {
    const dependencies = config.app.depends_on;

    for (const dep of dependencies) {
      if (dep === appPath) {
        throw new Error(
          `Self-dependency detected: ${extractAppLabel(appPath, rootDir)} depends on itself`,
        );
      }

      // Dependencies now include root-dir
      if (!existsSync(dep)) {
        throw new Error(
          `Dependency path does not exist: ${dep} (required by ${extractAppLabel(appPath, rootDir)})`,
        );
      }
    }
  }

  detectCircularDependencies(allConfigs, rootDir);
};

const detectCircularDependencies = (
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
): void => {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  for (const [appPath] of allConfigs) {
    if (
      hasCircularDependency(
        appPath,
        allConfigs,
        rootDir,
        visited,
        recursionStack,
      )
    ) {
      throw new Error(
        `Circular dependency detected involving: ${extractAppLabel(appPath, rootDir)}`,
      );
    }
  }
};

const hasCircularDependency = (
  appPath: string,
  allConfigs: Map<string, LocalConfig>,
  rootDir: string,
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
    const dependencies = config.app.depends_on;

    for (const dep of dependencies) {
      // Dependencies now include root-dir
      if (
        hasCircularDependency(dep, allConfigs, rootDir, visited, recursionStack)
      ) {
        return true;
      }
    }
  }

  recursionStack.delete(appPath);
  return false;
};
