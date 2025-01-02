import { getCommittedAt } from './utils';
import {
  InputJobParamsSchema,
  InputJobParam,
  OutputJobParam,
  DockerBuildGlobalConfig,
} from './schema';
import { Context } from '@actions/github/lib/context';
import { join } from 'path';
import { DateTime } from 'luxon';

type runParams = {
  globalConfig: DockerBuildGlobalConfig;
  jobParams: string;
  context: Context;
};
export function run({
  globalConfig,
  jobParams,
  context,
}: runParams): OutputJobParam[] {
  const parsedJobParams = InputJobParamsSchema.parse(JSON.parse(jobParams));

  return parsedJobParams.map((jobParam): OutputJobParam => {
    const localDockerBuildConfig = jobParam.configs.docker_build;
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
      ...jobParam,
      params: {
        ...jobParam.params,
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
          context: jobParam.app_context.path,
          tags: generateTags({
            committedAt: getCommittedAt(context),
            globalConfig,
            jobParam,
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
  jobParam: InputJobParam;
};
function generateTags({
  committedAt,
  globalConfig,
  jobParam,
}: generateTagsType): string[] {
  const registry = jobParam.configs.docker_build.registry;

  if (registry.type === 'aws') {
    const repository =
      globalConfig.job_types.docker_build.registries.aws.repositories[
        jobParam.configs.docker_build.registry.aws.repository
      ];
    if (!repository) {
      throw new Error(
        `Repository not found from Global Config: ${jobParam.configs.docker_build.registry.aws.repository}`,
      );
    }

    switch (jobParam.configs.docker_build.tagging) {
      case 'always_latest':
        return [`${join(repository.base_url, jobParam.app.name)}:latest`];
      case 'semver_datetime':
        return [
          `${join(
            repository.base_url,
            jobParam.app.name,
          )}:${generateSemverDatetimeTag(committedAt)}`,
        ];
      default:
        throw new Error(
          `Unsupported tagging: ${jobParam.configs.docker_build.tagging} for environment: ${registry.type}`,
        );
    }
  }

  throw new Error(`Unsupported environment: ${registry.type}`);
}

function generateSemverDatetimeTag(committedAt: number): string {
  return `0.0.${DateTime.fromSeconds(committedAt).toFormat('yyyyMMddHHmmss')}`;
}
