import { context } from '@actions/github';
import { resolvePath } from '@monotonix/utils';

type Context = typeof context;
import { generateImageReferences } from './generateImageReferences';
import {
  DockerBuildGlobalConfig,
  InputJobs,
  OutputJob,
  OutputJobs,
} from './schema';

type runParams = {
  globalConfig: DockerBuildGlobalConfig;
  jobs: InputJobs;
  context: Context;
  timezone: string;
};
export function run({
  globalConfig,
  jobs,
  context,
  timezone,
}: runParams): OutputJobs {
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

    const resolvedContext = localDockerBuildConfig.context
      ? resolvePath(localDockerBuildConfig.context, job.context.app_path)
      : job.context.app_path;

    const resolvedDockerfile = localDockerBuildConfig.dockerfile
      ? resolvePath(localDockerBuildConfig.dockerfile, job.context.app_path)
      : undefined;

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
          context: resolvedContext,
          ...(resolvedDockerfile && { dockerfile: resolvedDockerfile }),
          tags: generateImageReferences({
            context,
            globalConfig,
            inputJob: job,
            timezone,
          }).join(','),
          platforms: localDockerBuildConfig.platforms.join(','),
        },
      },
    };
  });
}
