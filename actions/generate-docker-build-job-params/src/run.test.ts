import { run } from './run';
import {
  DockerBuildGlobalConfig,
  DockerBuildJobConfig,
  DockerBuildJobParam,
} from './schema';
import { Context } from '@actions/github/lib/context';

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

  const stubJobConfig: DockerBuildJobConfig = {
    app: {
      name: 'hello-world',
    },
    app_context: {
      path: '/apps/hello-world',
      last_commit: {
        hash: '0000000000000000000000000000000000000000',
        timestamp: 0,
      },
      label: '',
    },
    type: 'docker_build',
    config: {
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
    on: {
      push: {
        branches: ['main'],
      },
    },
    keys: [],
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
      jobConfigs: JSON.stringify([stubJobConfig]),
      context: stubContext,
    });
    const expected: DockerBuildJobParam[] = [
      {
        ...stubJobConfig,
        param: {
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
    ];

    expect(result).toEqual(expected);
  });
});
