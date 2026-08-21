import { context } from '@actions/github';
import { extractAppLabel } from '@monotonix/utils';
import { DateTime } from 'luxon';
import { join } from 'path';
import { DockerBuildGlobalConfig, InputJob } from './schema';

type Context = typeof context;

type generateTagsType = {
  context: Context;
  globalConfig: DockerBuildGlobalConfig;
  inputJob: InputJob;
  timezone: string;
};
export const generateImageReferences = ({
  context,
  globalConfig,
  inputJob,
  timezone,
}: generateTagsType): string[] => {
  const baseUrl = resolveRepositoryBaseUrl(globalConfig, inputJob);
  const imageName = join(
    baseUrl,
    extractAppLabel(inputJob.context.app_path, inputJob.context.root_dir),
  );

  switch (inputJob.configs.docker_build.tagging) {
    case 'always_latest':
      return [`${imageName}:latest`];

    case 'semver_datetime':
      return [
        `${imageName}:${generateSemverDatetimeTag(getCommittedAt(context), timezone)}`,
      ];

    case 'pull_request':
      if (!context.payload.pull_request) {
        throw new Error(
          `Tagging strategy "pull_request" requires a pull request`,
        );
      }

      return [`${imageName}:pr-${context.payload.pull_request.number}`];

    default:
      throw new Error(
        `Unsupported tagging: ${inputJob.configs.docker_build.tagging}`,
      );
  }
};

const resolveRepositoryBaseUrl = (
  globalConfig: DockerBuildGlobalConfig,
  inputJob: InputJob,
): string => {
  const registry = inputJob.configs.docker_build.registry;
  const registries = globalConfig.job_types.docker_build.registries;

  switch (registry.type) {
    case 'aws': {
      const repository = registries.aws?.repositories[registry.aws.repository];
      if (!repository) {
        throw new Error(
          `Repository not found from Global Config: ${registry.aws.repository}`,
        );
      }
      return repository.base_url;
    }

    case 'gcp': {
      const repository = registries.gcp?.repositories[registry.gcp.repository];
      if (!repository) {
        throw new Error(
          `Repository not found from Global Config: ${registry.gcp.repository}`,
        );
      }
      return repository.base_url;
    }
  }
};

export const generateSemverDatetimeTag = (
  timestamp: number,
  timezone: string,
): string => {
  const datetime = DateTime.fromSeconds(timestamp).setZone(timezone);
  if (!datetime.isValid) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }

  return `0.0.${datetime.toFormat('yyyyMMddHHmmss')}`;
};

export function getCommittedAt(context: Context): number {
  if (context.payload.head_commit?.timestamp) {
    return DateTime.fromISO(context.payload.head_commit.timestamp).toSeconds();
  }

  throw new Error('head_commit.timestamp is required');
}
