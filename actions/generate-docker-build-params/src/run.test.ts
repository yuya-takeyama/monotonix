import { run } from './run';
import { DockerBuildGlobalConfig, DockerBuildJob } from './schema';
import { Context } from '@actions/github/lib/context';

describe('run function', () => {
  const stubGlobalConfig: DockerBuildGlobalConfig = {
    loaders: {
      docker_build: {
        environment: {
          type: 'aws',
          aws: {
            identities: {
              'some-registry': {
                iam_role: 'some-identity',
                region: 'some-region',
              },
            },
            registries: {
              'some-registry': {
                identity: 'some-identity',
                region: 'some-region',
                repository_base: 'some-repository-base',
              },
            },
          },
        },
      },
    },
  };

  const stubJob: DockerBuildJob = {
    app: {
      name: 'hello-world',
      path: '/apps/hello-world',
    },
    config: {
      loader: 'docker_build',
      environment: {
        type: 'aws',
        aws: {
          identity: 'some-registry',
          registry: 'some-registry',
        },
      },
      tagging: 'always_latest',
      platforms: ['linux/amd64', 'linux/arm64'],
    },
  };

  const stubContext: Context = {
    ref: 'refs/heads/main',
    payload: {
      head_commit: {
        timestamp: '2023-10-10T10:00:00Z',
      },
    },
  } as any;

  it('should return build parameters', () => {
    const result = run(stubGlobalConfig, [stubJob], stubContext);

    expect(result).toEqual([
      {
        path: '/path/to/app',
        committed_at:
          new Date(stubContext.payload.head_commit.timestamp).getTime() / 1000,
        event: {
          type: 'push',
          branches: ['main'],
        },
        job: {
          loader: 'docker_build',
          config: {
            environment: {
              type: 'aws',
              aws: {
                identity: {
                  iam_role: 'some-identity',
                  region: 'some-region',
                },
                registry: {
                  type: 'private',
                },
              },
            },
            context: '/path/to/app',
            tags: 'some-repository-base/hello-world:latest',
            platforms: 'linux/amd64,linux/arm64',
          },
        },
        keys: [
          ['loader', 'docker_build'],
          ['event_type', 'push'],
          ['event_ref', stubContext.ref],
          ['environment_type', 'aws'],
          ['registry', 'some-registry'],
          ['tagging', 'always_latest'],
          ['platforms', 'linux/amd64,linux/arm64'],
        ],
      },
    ]);
  });
});
