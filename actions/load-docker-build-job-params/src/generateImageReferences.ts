import { Context } from '@actions/github/lib/context';
import { DockerBuildGlobalConfig, InputJob } from './schema';
import { join } from 'path';
import { DateTime } from 'luxon';

type generateTagsType = {
  context: Context;
  globalConfig: DockerBuildGlobalConfig;
  inputJob: InputJob;
};
export const generateImageReferences = ({
  context,
  globalConfig,
  inputJob,
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
        return [`${join(repository.base_url, inputJob.app.name)}:latest`];

      case 'semver_datetime':
        return [
          `${join(
            repository.base_url,
            inputJob.app.name,
          )}:${generateSemverDatetimeTag(context)}`,
        ];

      case 'pull_request':
        if (!context.payload.pull_request) {
          throw new Error(
            `Tagging strategy "pull_request" requires a pull request`,
          );
        }

        return [
          `${join(repository.base_url, inputJob.app.name)}:pr-${context.payload.pull_request.number}`,
        ];

      default:
        throw new Error(
          `Unsupported tagging: ${inputJob.configs.docker_build.tagging} for environment: ${registry.type}`,
        );
    }
  }

  throw new Error(`Unsupported environment: ${registry.type}`);
};

export const generateSemverDatetimeTag = (context: Context): string => {
  return `0.0.${DateTime.fromSeconds(getCommittedAt(context)).toFormat('yyyyMMddHHmmss')}`;
};

export function getCommittedAt(context: Context) {
  return new Date(context.payload.head_commit.timestamp).getTime() / 1000;
}
