import { Context } from '@actions/github/lib/context';
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
          context: job.context.app_path,
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
