import { getCommittedAt } from './utils';
import {
  InputJobs,
  InputJob,
  OutputJobs,
  OutputJob,
  DockerBuildGlobalConfig,
} from './schema';
import { Context } from '@actions/github/lib/context';
import { join } from 'path';
import { DateTime } from 'luxon';

type runParams = {
  globalConfig: DockerBuildGlobalConfig;
  jobs: InputJobs;
  context: Context;
};
export function run({ globalConfig, jobs, context }: runParams): OutputJobs {
  return jobs.map((job): OutputJob => {
    const localDockerBuildConfig = job.configs.docker_build;
    const repository =
      globalConfig.job_types.docker_build.registries.aws.repositories[
        localDockerBuildConfig.registry.aws.repository
      ];
    if (!repository) {
      throw new Error(
        `Repository not found from Global Config: ${localDockerBuildConfig.registry.aws.repository}`,
      );
    }

    const iam =
      globalConfig.job_types.docker_build.registries.aws.iams[
        localDockerBuildConfig.registry.aws.repository
      ];
    if (!iam) {
      throw new Error(
        `IAM not found from Global Config: ${localDockerBuildConfig.registry.aws.iam}`,
      );
    }

    return {
      ...job,
      params: {
        ...job.params,
        docker_build: {
          registry: {
            type: 'aws',
            aws: {
              iam: {
                role: iam.role,
                region: iam.region,
              },
              repository: {
                type: repository.type,
              },
            },
          },
          context: job.app_context.path,
          tags: generateTags({
            committedAt: getCommittedAt(context),
            globalConfig,
            inputJob: job,
          }).join(','),
          platforms: localDockerBuildConfig.platforms.join(','),
        },
      },
    };
  });
}

type generateTagsType = {
  committedAt: number;
  globalConfig: DockerBuildGlobalConfig;
  inputJob: InputJob;
};
function generateTags({
  committedAt,
  globalConfig,
  inputJob,
}: generateTagsType): string[] {
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
          )}:${generateSemverDatetimeTag(committedAt)}`,
        ];
      default:
        throw new Error(
          `Unsupported tagging: ${inputJob.configs.docker_build.tagging} for environment: ${registry.type}`,
        );
    }
  }

  throw new Error(`Unsupported environment: ${registry.type}`);
}

function generateSemverDatetimeTag(committedAt: number): string {
  return `0.0.${DateTime.fromSeconds(committedAt).toFormat('yyyyMMddHHmmss')}`;
}
