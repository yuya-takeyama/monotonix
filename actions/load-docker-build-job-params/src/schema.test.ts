import { DockerBuildGlobalConfigSchema, InputJobsSchema } from './schema';

describe('DockerBuildGlobalConfigSchema', () => {
  const awsRegistry = {
    iams: {
      dev: {
        role: 'arn:aws:iam::123456789012:role/dev',
        region: 'ap-northeast-1',
      },
    },
    repositories: {
      dev: {
        base_url: '123456789012.dkr.ecr.ap-northeast-1.amazonaws.com/myrepo',
      },
    },
  };

  const gcpRegistry = {
    iams: {
      dev: {
        workload_identity_provider:
          'projects/123456789/locations/global/workloadIdentityPools/github/providers/my-provider',
        service_account: 'builder@my-project.iam.gserviceaccount.com',
      },
    },
    repositories: {
      dev: {
        base_url: 'asia-northeast1-docker.pkg.dev/my-project/my-repository',
      },
    },
  };

  it('parses a config with only aws', () => {
    const config = DockerBuildGlobalConfigSchema.parse({
      job_types: { docker_build: { registries: { aws: awsRegistry } } },
    });
    expect(
      config.job_types.docker_build.registries.aws?.repositories['dev'].type,
    ).toBe('private');
    expect(config.job_types.docker_build.registries.gcp).toBeUndefined();
  });

  it('parses a config with only gcp', () => {
    const config = DockerBuildGlobalConfigSchema.parse({
      job_types: { docker_build: { registries: { gcp: gcpRegistry } } },
    });
    expect(
      config.job_types.docker_build.registries.gcp?.iams['dev'].service_account,
    ).toBe('builder@my-project.iam.gserviceaccount.com');
    expect(config.job_types.docker_build.registries.aws).toBeUndefined();
  });

  it('parses a config with both aws and gcp', () => {
    const config = DockerBuildGlobalConfigSchema.parse({
      job_types: {
        docker_build: { registries: { aws: awsRegistry, gcp: gcpRegistry } },
      },
    });
    expect(config.job_types.docker_build.registries.aws?.iams['dev'].role).toBe(
      'arn:aws:iam::123456789012:role/dev',
    );
    expect(
      config.job_types.docker_build.registries.gcp?.repositories['dev']
        .base_url,
    ).toBe('asia-northeast1-docker.pkg.dev/my-project/my-repository');
  });

  it('rejects an empty base_url', () => {
    expect(() =>
      DockerBuildGlobalConfigSchema.parse({
        job_types: {
          docker_build: {
            registries: {
              gcp: {
                iams: gcpRegistry.iams,
                repositories: { dev: { base_url: '' } },
              },
            },
          },
        },
      }),
    ).toThrow();
  });
});

describe('InputJobsSchema registry union', () => {
  const baseJob = {
    app: {
      depends_on: [],
      metadata: {},
    },
    context: {
      dedupe_key: 'refs/heads/main',
      github_ref: 'refs/heads/main',
      app_path: 'apps/hello-world',
      root_dir: 'apps',
      job_key: 'job1',
      last_commit: {
        hash: '0000000000000000000000000000000000000000',
        timestamp: 0,
      },
      label: '',
    },
    on: {
      push: {
        branches: ['main'],
      },
    },
    params: {},
    metadata: {},
  };

  it('accepts registry type aws with aws key', () => {
    const jobs = InputJobsSchema.parse([
      {
        ...baseJob,
        configs: {
          docker_build: {
            registry: {
              type: 'aws',
              aws: { iam: 'dev', repository: 'dev' },
            },
            tagging: 'always_latest',
            platforms: ['linux/amd64'],
          },
        },
      },
    ]);
    expect(jobs[0].configs.docker_build.registry.type).toBe('aws');
  });

  it('accepts registry type gcp with gcp key', () => {
    const jobs = InputJobsSchema.parse([
      {
        ...baseJob,
        configs: {
          docker_build: {
            registry: {
              type: 'gcp',
              gcp: { iam: 'dev', repository: 'dev' },
            },
            tagging: 'always_latest',
            platforms: ['linux/amd64'],
          },
        },
      },
    ]);
    const registry = jobs[0].configs.docker_build.registry;
    expect(registry.type).toBe('gcp');
    if (registry.type === 'gcp') {
      expect(registry.gcp.iam).toBe('dev');
    }
  });

  it('rejects registry type gcp without a gcp key', () => {
    expect(() =>
      InputJobsSchema.parse([
        {
          ...baseJob,
          configs: {
            docker_build: {
              registry: {
                type: 'gcp',
                aws: { iam: 'dev', repository: 'dev' },
              },
              tagging: 'always_latest',
              platforms: ['linux/amd64'],
            },
          },
        },
      ]),
    ).toThrow();
  });
});
