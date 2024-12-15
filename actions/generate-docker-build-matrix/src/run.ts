import { dirname } from 'path';
import { getCommittedAt } from './utils';
import { GlobalConfig, LocalConfig } from './schemas';
import { Context } from '@actions/github/lib/context';

export function run(
  globalConfig: GlobalConfig,
  localConfigs: { path: string; config: LocalConfig }[],
  context: Context,
) {
  return localConfigs.flatMap(
    ({ path: localConfigPath, config: localConfig }) => {
      const appDir = dirname(localConfigPath);

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
              environment_type: 'aws',
              aws: {
                identity:
                  globalConfig.loaders.docker_build.aws.identities[
                    job.docker_build.aws.registry
                  ],
                registry:
                  globalConfig.loaders.docker_build.aws.registries[
                    job.docker_build.aws.registry
                  ],
              },
              tagging: job.docker_build.tagging,
              platforms: job.docker_build.platforms,
            },
          },
          keys: [
            ['loader', 'docker_build'],
            ['event_type', 'push'],
            ['event_ref', context.ref],
            ['environment_type', job.docker_build.environment_type],
            ['registry', job.docker_build.aws.registry],
            ['tagging', job.docker_build.tagging],
            ['platforms', job.docker_build.platforms],
          ],
        }));
    },
  );
}
