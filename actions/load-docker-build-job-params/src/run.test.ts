import { context } from '@actions/github';
import { run } from './run';

type Context = typeof context;

import { DockerBuildGlobalConfig, InputJob, OutputJob } from './schema';

describe('run', () => {
  const stubGlobalConfig: DockerBuildGlobalConfig = {
    job_types: {
      docker_build: {
        registries: {
          aws: {
            iams: {
              'some-registry': {
                role: 'some-identity',
                region: 'some-region',
              },
            },
            repositories: {
              'some-registry': {
                type: 'private',
                base_url: 'some-repository-base',
              },
            },
          },
        },
      },
    },
  };

  const stubJob: InputJob = {
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
    configs: {
      docker_build: {
        registry: {
          type: 'aws',
          aws: {
            iam: 'some-registry',
            repository: 'some-registry',
          },
        },
        tagging: 'always_latest',
        platforms: ['linux/amd64', 'linux/arm64'],
      },
    },
    on: {
      push: {
        branches: ['main'],
      },
    },
    params: {},
    metadata: {},
  };

  const stubContext = {
    ref: 'refs/heads/main',
    payload: {
      head_commit: {
        timestamp: '2023-10-10T10:00:00Z',
      },
    },
  } as unknown as Context;

  it('returns build parameters for docker build', () => {
    const result = run({
      globalConfig: stubGlobalConfig,
      jobs: [stubJob],
      context: stubContext,
      timezone: 'UTC',
    });
    const expected: OutputJob[] = [
      {
        ...stubJob,
        params: {
          docker_build: {
            registry: {
              type: 'aws',
              aws: {
                iam: {
                  role: 'some-identity',
                  region: 'some-region',
                },
                repository: {
                  type: 'private',
                },
              },
            },
            context: 'apps/hello-world',
            tags: 'some-repository-base/hello-world:latest',
            platforms: 'linux/amd64,linux/arm64',
          },
        },
      },
    ];

    expect(result).toEqual(expected);
  });

  it('resolves custom context and dockerfile paths', () => {
    const jobWithCustomPaths: InputJob = {
      ...stubJob,
      context: {
        ...stubJob.context,
        app_path: 'apps/example/subapp',
      },
      configs: {
        ...stubJob.configs,
        docker_build: {
          ...stubJob.configs.docker_build,
          context: '../../',
          dockerfile: 'Dockerfile',
        },
      },
    };

    const result = run({
      globalConfig: stubGlobalConfig,
      jobs: [jobWithCustomPaths],
      context: stubContext,
      timezone: 'UTC',
    });

    expect(result[0].params.docker_build.context).toBe('apps');
    expect(result[0].params.docker_build.dockerfile).toBe(
      'apps/example/subapp/Dockerfile',
    );
  });

  it('uses app_path as context when custom context is not specified', () => {
    const result = run({
      globalConfig: stubGlobalConfig,
      jobs: [stubJob],
      context: stubContext,
      timezone: 'UTC',
    });

    expect(result[0].params.docker_build.context).toBe('apps/hello-world');
    expect(result[0].params.docker_build.dockerfile).toBeUndefined();
  });

  it('resolves only context when dockerfile is not specified', () => {
    const jobWithContextOnly: InputJob = {
      ...stubJob,
      configs: {
        ...stubJob.configs,
        docker_build: {
          ...stubJob.configs.docker_build,
          context: '../',
        },
      },
    };

    const result = run({
      globalConfig: stubGlobalConfig,
      jobs: [jobWithContextOnly],
      context: stubContext,
      timezone: 'UTC',
    });

    expect(result[0].params.docker_build.context).toBe('apps');
    expect(result[0].params.docker_build.dockerfile).toBeUndefined();
  });

  it('resolves $repoRoot/ prefixed paths from repository root', () => {
    const jobWithRootPaths: InputJob = {
      ...stubJob,
      context: {
        ...stubJob.context,
        app_path: 'apps/mono/apps/web',
      },
      configs: {
        ...stubJob.configs,
        docker_build: {
          ...stubJob.configs.docker_build,
          context: '$repoRoot/apps/mono',
          dockerfile: '$repoRoot/apps/mono/apps/web/Dockerfile',
        },
      },
    };

    const result = run({
      globalConfig: stubGlobalConfig,
      jobs: [jobWithRootPaths],
      context: stubContext,
      timezone: 'UTC',
    });

    expect(result[0].params.docker_build.context).toBe('apps/mono');
    expect(result[0].params.docker_build.dockerfile).toBe(
      'apps/mono/apps/web/Dockerfile',
    );
  });
});
