import { join } from 'node:path';
import { context, getOctokit } from '@actions/github';
import { Job, Jobs } from '@monotonix/schema';
import { statSync } from 'fs';

export const matchesDependency = (
  filePath: string,
  pathInfo: PathInfo,
): boolean => {
  if (pathInfo.isDirectory) {
    // For directories, check if the file is within the directory
    return filePath.startsWith(
      pathInfo.path.endsWith('/') ? pathInfo.path : pathInfo.path + '/',
    );
  } else {
    // For files, check exact match
    return filePath === pathInfo.path;
  }
};

// Pure function for dependency path resolution
export type PathInfo = {
  path: string;
  isDirectory: boolean;
};

export const resolveDependencyPaths = (
  dependencies: string[],
  rootDir: string,
  getPathInfo: (path: string) => PathInfo,
): PathInfo[] => {
  return dependencies.map(dep => {
    const depPath = join(rootDir, dep);
    return getPathInfo(depPath);
  });
};

export const jobMatchesChangedFiles = (
  job: Job,
  changedFiles: string[],
  dependencyPathInfos: PathInfo[],
): boolean => {
  const appPath = job.context.app_path;
  const dependencies = job.app.depends_on;

  return changedFiles.some(file => {
    // Check if file is within the app path
    if (file.startsWith(appPath.endsWith('/') ? appPath : appPath + '/')) {
      return true;
    }

    // Check dependencies
    return dependencyPathInfos.some((pathInfo, index) => {
      if (index >= dependencies.length) return false;
      return matchesDependency(file, pathInfo);
    });
  });
};

// Helper function for actual file system access
export const getPathInfo = (path: string): PathInfo => {
  try {
    const stat = statSync(path);
    return { path, isDirectory: stat.isDirectory() };
  } catch {
    // If path doesn't exist, assume it's a file
    return { path, isDirectory: false };
  }
};

type runParams = {
  githubToken: string;
  jobs: Jobs;
  rootDir: string;
};
export const run = async ({
  githubToken,
  jobs,
  rootDir,
}: runParams): Promise<Jobs> => {
  const octokit = getOctokit(githubToken);

  switch (context.eventName) {
    case 'pull_request':
    case 'pull_request_target': {
      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: context.issue.number,
      });

      const changedFiles = files.map(file => file.filename);
      return jobs.filter(job => {
        const dependencies = job.app.depends_on;
        const dependencyPathInfos = resolveDependencyPaths(
          dependencies,
          rootDir,
          getPathInfo,
        );
        return jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos);
      });
    }

    default: {
      const { data: commits } = await octokit.rest.repos.getCommit({
        owner: context.repo.owner,
        repo: context.repo.repo,
        ref: context.sha,
      });

      const changedFiles = (commits.files || []).map(file => file.filename);
      return jobs.filter(job => {
        const dependencies = job.app.depends_on;
        const dependencyPathInfos = resolveDependencyPaths(
          dependencies,
          rootDir,
          getPathInfo,
        );
        return jobMatchesChangedFiles(job, changedFiles, dependencyPathInfos);
      });
    }
  }
};
