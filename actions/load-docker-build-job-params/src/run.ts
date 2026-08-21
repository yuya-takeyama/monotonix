import { context } from '@actions/github';
import { resolvePath } from '@monotonix/utils';
import { generateImageReferences } from './generateImageReferences';
import {
  DockerBuildGlobalConfig,
  InputJob,
  InputJobs,
  OutputJob,
  OutputJobs,
} from './schema';

type Context = typeof context;

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
          registry: resolveRegistry(
            globalConfig,
            localDockerBuildConfig.registry,
          ),
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

function resolveRegistry(
  globalConfig: DockerBuildGlobalConfig,
  registry: InputJob['configs']['docker_build']['registry'],
): OutputJob['params']['docker_build']['registry'] {
  const registries = globalConfig.job_types.docker_build.registries;

  switch (registry.type) {
    case 'aws': {
      const awsConfig = registries.aws;
      if (!awsConfig) {
        throw new Error(
          `Registry provider not configured in Global Config: aws`,
        );
      }

      const repository = awsConfig.repositories[registry.aws.repository];
      if (!repository) {
        throw new Error(
          `Repository not found from Global Config: ${registry.aws.repository}`,
        );
      }

      const iam = awsConfig.iams[registry.aws.iam];
      if (!iam) {
        throw new Error(
          `IAM not found from Global Config: ${registry.aws.iam}`,
        );
      }

      return {
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
      };
    }

    case 'gcp': {
      const gcpConfig = registries.gcp;
      if (!gcpConfig) {
        throw new Error(
          `Registry provider not configured in Global Config: gcp`,
        );
      }

      const repository = gcpConfig.repositories[registry.gcp.repository];
      if (!repository) {
        throw new Error(
          `Repository not found from Global Config: ${registry.gcp.repository}`,
        );
      }

      const iam = gcpConfig.iams[registry.gcp.iam];
      if (!iam) {
        throw new Error(
          `IAM not found from Global Config: ${registry.gcp.iam}`,
        );
      }

      return {
        type: 'gcp',
        gcp: {
          iam: {
            workload_identity_provider: iam.workload_identity_provider,
            service_account: iam.service_account,
          },
          repository: {
            host: repository.base_url.split('/')[0]!,
          },
        },
      };
    }
  }
}
