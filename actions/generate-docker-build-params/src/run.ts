import { getCommittedAt } from './utils';
import {
  DockerBuildJobConfigSchema,
  DockerBuildJobConfig,
  DockerBuildGlobalConfig,
  DockerBuildParam,
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
export function run({
  globalConfig,
  jobConfigs,
  context,
}: runParams): DockerBuildParam[] {
  const parsedJobConfigs = z
    .array(DockerBuildJobConfigSchema)
    .parse(JSON.parse(jobConfigs));

  return parsedJobConfigs.map(jobConfig => {
    const registryConfig =
      globalConfig.loaders.docker_build.environment.aws.registries[
        jobConfig.config.environment.aws.registry
      ];
    const registry = {
      type: registryConfig.type,
      region: registryConfig.region,
    };
    const identity =
      globalConfig.loaders.docker_build.environment.aws.identities[
        jobConfig.config.environment.aws.registry
      ];
    const buildParam: DockerBuildParam = {
      app: jobConfig.app,
      keys: [
        ['loader', 'docker_build'],
        ['event_type', 'push'],
        ['event_ref', context.ref],
      ],
      param: {
        environment: {
          type: 'aws',
          aws: {
            identity: identity,
            registry: registryConfig,
          },
        },
        context: jobConfig.app.path,
        tags: generateTags({
          committedAt: getCommittedAt(context),
          globalConfig,
          jobConfig: jobConfig,
        }).join(','),
        platforms: jobConfig.config.platforms.join(','),
      },
    };

    return buildParam;
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
  const environment = jobConfig.config.environment;

  if (environment.type === 'aws') {
    const registry =
      globalConfig.loaders.docker_build.environment.aws.registries[
        environment.aws.registry
      ];

    switch (jobConfig.config.tagging) {
      case 'always_latest':
        return [`${join(registry.repository_base, jobConfig.app.name)}:latest`];
      case 'semver_datetime':
        return [
          `${join(
            registry.repository_base,
            jobConfig.app.name,
          )}:${generateSemverDatetimeTag(committedAt)}`,
        ];
      default:
        throw new Error(
          `Unsupported tagging: ${jobConfig.config.tagging} for environment: ${environment.type}`,
        );
    }
  }

  throw new Error(`Unsupported environment: ${environment.type}`);
}

function generateSemverDatetimeTag(committedAt: number): string {
  return `0.0.${DateTime.fromSeconds(committedAt).toFormat('yyyyMMddHHmmss')}`;
}
