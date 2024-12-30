import { getCommittedAt } from './utils';
import {
  DockerBuildJobConfigSchema,
  DockerBuildJobConfig,
  DockerBuildGlobalConfig,
  DockerBuildJobParamSchema,
} from './schema';
import { Context } from '@actions/github/lib/context';
import { join } from 'path';
import { DateTime } from 'luxon';
import { z } from 'zod';

type runParams = {
  globalConfig: DockerBuildGlobalConfig;
  jobConfigs: string;
  context: Context;
};
export function run({ globalConfig, jobConfigs, context }: runParams) {
  const parsedJobConfigs = z
    .array(DockerBuildJobConfigSchema)
    .parse(JSON.parse(jobConfigs));

  return parsedJobConfigs.map(jobConfig => {
    const repository =
      globalConfig.job_types.docker_build.registries.aws.repositories[
        jobConfig.config.registry.aws.repository
      ];
    if (!repository) {
      throw new Error(
        `Repository not found from Global Config: ${jobConfig.config.registry.aws.repository}`,
      );
    }

    const iam =
      globalConfig.job_types.docker_build.registries.aws.iams[
        jobConfig.config.registry.aws.repository
      ];
    if (!iam) {
      throw new Error(
        `IAM not found from Global Config: ${jobConfig.config.registry.aws.iam}`,
      );
    }

    return DockerBuildJobParamSchema.parse({
      ...jobConfig,
      param: {
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
        context: jobConfig.app_context.path,
        tags: generateTags({
          committedAt: getCommittedAt(context),
          globalConfig,
          jobConfig: jobConfig,
        }).join(','),
        platforms: jobConfig.config.platforms.join(','),
      },
    });
  });
}

type generateTagsType = {
  committedAt: number;
  globalConfig: DockerBuildGlobalConfig;
  jobConfig: DockerBuildJobConfig;
};
function generateTags({
  committedAt,
  globalConfig,
  jobConfig,
}: generateTagsType): string[] {
  const registry = jobConfig.config.registry;

  if (registry.type === 'aws') {
    const repository =
      globalConfig.job_types.docker_build.registries.aws.repositories[
        jobConfig.config.registry.aws.repository
      ];
    if (!repository) {
      throw new Error(
        `Repository not found from Global Config: ${jobConfig.config.registry.aws.repository}`,
      );
    }

    switch (jobConfig.config.tagging) {
      case 'always_latest':
        return [`${join(repository.base_url, jobConfig.app.name)}:latest`];
      case 'semver_datetime':
        return [
          `${join(
            repository.base_url,
            jobConfig.app.name,
          )}:${generateSemverDatetimeTag(committedAt)}`,
        ];
      default:
        throw new Error(
          `Unsupported tagging: ${jobConfig.config.tagging} for environment: ${registry.type}`,
        );
    }
  }

  throw new Error(`Unsupported environment: ${registry.type}`);
}

function generateSemverDatetimeTag(committedAt: number): string {
  return `0.0.${DateTime.fromSeconds(committedAt).toFormat('yyyyMMddHHmmss')}`;
}
