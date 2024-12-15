import { run } from './run';
import { GlobalConfig, LocalConfig } from './schemas';
import { Context } from '@actions/github/lib/context';

describe('run function', () => {
  const stubGlobalConfig: GlobalConfig = {
    loaders: {
      docker_build: {
        aws: {
          identities: {
            'some-registry': 'some-identity',
          },
          registries: {
            'some-registry': 'some-registry-url',
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
          environment_type: 'aws',
          aws: {
            identity: 'some-identity',
            registry: 'some-registry',
          },
          tagging: 'semver_datetime',
          platforms: ['linux/amd64'],
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
    const localConfigs = [{ path: '/path/to/config', config: stubLocalConfig }];

    const result = run(stubGlobalConfig, localConfigs, stubContext);

    expect(result).toEqual([
      {
        path: '/path/to',
        committed_at:
          new Date(stubContext.payload.head_commit.timestamp).getTime() / 1000,
        event: {
          type: 'push',
          branches: ['main'],
        },
        job: {
          loader: 'docker_build',
          config: {
            environment_type: 'aws',
            aws: {
              identity: 'some-identity',
              registry: 'some-registry-url',
            },
            tagging: 'semver_datetime',
            platforms: ['linux/amd64'],
          },
        },
        keys: [
          ['loader', 'docker_build'],
          ['event_type', 'push'],
          ['event_ref', stubContext.ref],
          ['environment_type', 'aws'],
          ['registry', 'some-registry'],
          ['tagging', 'semver_datetime'],
          ['platforms', ['linux/amd64']],
        ],
      },
    ]);
  });
});
