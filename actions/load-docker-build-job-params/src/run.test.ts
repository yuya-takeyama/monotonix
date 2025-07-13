import { Context } from '@actions/github/lib/context';
import { run } from './run';
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
      name: 'hello-world',
      depends_on: [],
    },
    context: {
      dedupe_key: 'refs/heads/main',
      github_ref: 'refs/heads/main',
      app_path: '/apps/hello-world',
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
  };

  const stubContext: Context = {
    ref: 'refs/heads/main',
    payload: {
      head_commit: {
        timestamp: '2023-10-10T10:00:00Z',
      },
    },
  } as any;

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
            context: '/apps/hello-world',
            tags: 'some-repository-base/hello-world:latest',
            platforms: 'linux/amd64,linux/arm64',
          },
        },
      },
    ];

    expect(result).toEqual(expected);
  });
});
