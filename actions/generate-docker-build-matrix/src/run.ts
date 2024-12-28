import { dirname } from 'path';
import { getCommittedAt } from './utils';
import { GlobalConfig, LocalConfig, JobConfigParameter } from './schemas';
import { Context } from '@actions/github/lib/context';
import { join } from 'path';
import { DateTime } from 'luxon';

export function run(
  globalConfig: GlobalConfig,
  localConfigs: { path: string; config: LocalConfig }[],
  context: Context,
): JobConfigParameter[] {
  return localConfigs.flatMap(
    ({ path: localConfigPath, config: localConfig }) => {
      const appDir = dirname(localConfigPath);
      const committedAt = getCommittedAt(context);

      return localConfig.jobs
        .filter(job => job.loader === 'docker_build')
        .map(job => ({
          path: appDir,
          committed_at: getCommittedAt(context),
          event: {
            type: 'push',
            branches: job.on.push.branches,
          },
          job: {
            loader: 'docker_build',
            config: {
              environment: {
                type: 'aws',
                aws: {
                  identity:
                    globalConfig.loaders.docker_build.environment.aws
                      .identities[job.docker_build.environment.aws.registry],
                  registry: {
                    type: 'private',
                  },
                },
              },
              context: appDir,
              tags: generateTags({
                appDir,
                committedAt,
                globalConfig,
                localConfigMetadata: localConfig.metadata,
                localConfigJob: job,
              }).join(','),
              platforms: job.docker_build.platforms.join(','),
            },
          },
          keys: [
            ['loader', 'docker_build'],
            ['event_type', 'push'],
            ['event_ref', context.ref],
            ['environment_type', job.docker_build.environment.type],
            ['registry', job.docker_build.environment.aws.registry],
            ['tagging', job.docker_build.tagging],
            ['platforms', job.docker_build.platforms.join(',')],
          ],
        }));
    },
  );
}

type generateTagsType = {
  appDir: string;
  committedAt: number;
  globalConfig: GlobalConfig;
  localConfigMetadata: LocalConfig['metadata'];
  localConfigJob: LocalConfig['jobs'][number];
};
function generateTags({
  committedAt,
  globalConfig,
  localConfigMetadata,
  localConfigJob,
}: generateTagsType): string[] {
  const environment = localConfigJob.docker_build.environment;

  if (environment.type === 'aws') {
    const registry =
      globalConfig.loaders.docker_build.environment.aws.registries[
        localConfigJob.docker_build.environment.aws.registry
      ];

    switch (localConfigJob.docker_build.tagging) {
      case 'always_latest':
        return [
          `${join(registry.repository_base, localConfigMetadata.name)}:latest`,
        ];
      case 'semver_datetime':
        return [
          `${join(
            registry.repository_base,
            localConfigMetadata.name,
          )}:${generateSemverDatetimeTag(committedAt)}`,
        ];
      default:
        throw new Error(
          `Unsupported tagging: ${localConfigJob.docker_build.tagging}`,
        );
    }
  }

  throw new Error(`Unsupported environment: ${environment.type}`);
}

function generateSemverDatetimeTag(committedAt: number): string {
  return `0.0.${DateTime.fromSeconds(committedAt).toFormat('yyyyMMddHHmmss')}`;
}
