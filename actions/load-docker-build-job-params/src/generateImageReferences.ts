import { context } from '@actions/github';
import { extractAppLabel } from '@monotonix/utils';

type Context = typeof context;
import { DateTime } from 'luxon';
import { join } from 'path';
import { DockerBuildGlobalConfig, InputJob } from './schema';

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
  const registry = inputJob.configs.docker_build.registry;

  if (registry.type === 'aws') {
    const repository =
      globalConfig.job_types.docker_build.registries.aws.repositories[
        inputJob.configs.docker_build.registry.aws.repository
      ];
    if (!repository) {
      throw new Error(
        `Repository not found from Global Config: ${inputJob.configs.docker_build.registry.aws.repository}`,
      );
    }

    switch (inputJob.configs.docker_build.tagging) {
      case 'always_latest':
        return [
          `${join(repository.base_url, extractAppLabel(inputJob.context.app_path, inputJob.context.root_dir))}:latest`,
        ];

      case 'semver_datetime': {
        const timestamp = getCommittedAt(context);
        return [
          `${join(
            repository.base_url,
            extractAppLabel(
              inputJob.context.app_path,
              inputJob.context.root_dir,
            ),
          )}:${generateSemverDatetimeTag(timestamp, timezone)}`,
        ];
      }

      case 'pull_request':
        if (!context.payload.pull_request) {
          throw new Error(
            `Tagging strategy "pull_request" requires a pull request`,
          );
        }

        return [
          `${join(repository.base_url, extractAppLabel(inputJob.context.app_path, inputJob.context.root_dir))}:pr-${context.payload.pull_request.number}`,
        ];

      default:
        throw new Error(
          `Unsupported tagging: ${inputJob.configs.docker_build.tagging} for environment: ${registry.type}`,
        );
    }
  }

  throw new Error(`Unsupported environment: ${registry.type}`);
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
