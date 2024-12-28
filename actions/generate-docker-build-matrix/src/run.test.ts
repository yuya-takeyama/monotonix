import { run } from './run';
import { GlobalConfig, LocalConfig } from './schemas';
import { Context } from '@actions/github/lib/context';

describe('run function', () => {
  const stubGlobalConfig: GlobalConfig = {
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

  const stubLocalConfig: LocalConfig = {
    jobs: [
      {
        on: {
          push: {
            branches: ['main'],
          },
        },
        loader: 'docker_build',
        docker_build: {
          environment: {
            type: 'aws',
            aws: {
              identity: 'some-identity',
              registry: 'some-registry',
            },
          },
          tagging: 'always_latest',
          platforms: ['linux/amd64', 'linux/arm64'],
        },
      },
    ],
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
    const localConfigs = [
      {
        path: '/path/to/app/monotonix.yaml',
        config: stubLocalConfig,
      },
    ];

    const result = run(stubGlobalConfig, localConfigs, stubContext);

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
            tags: 'some-repository-base/path/to/app:latest',
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
