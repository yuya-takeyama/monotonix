import { Context } from '@actions/github/lib/context';
import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';

describe('filterJobsByGitHubContext', () => {
  const stubLocalConfigs = [
    {
      app: {
        name: 'hello-world',
        path: 'apps/hello-world/monotonix.yaml',
      },
      on: {
        push: {
          branches: ['main'],
        },
      },
      config: {
        loader: 'docker_build',
        docker_build: {
          environment: {
            type: 'aws',
            aws: {
              identity: 'dev_main',
              registry: 'dev_main',
            },
          },
          tagging: 'always_latest',
          platforms: ['linux/amd64'],
        },
      },
    },
    {
      app: {
        name: 'hello-world',
        path: 'apps/hello-world/monotonix.yaml',
      },
      on: {
        pull_request: null,
      },
      config: {
        loader: 'docker_build',
        docker_build: {
          environment: {
            type: 'aws',
            aws: {
              identity: 'dev_main',
              registry: 'dev_main',
            },
          },
          tagging: 'always_latest',
          platforms: ['linux/amd64'],
        },
      },
    },
  ];

  describe('push event', () => {
    it('should return jobs that match the branch', () => {
      const context: Context = {
        eventName: 'push',
        // @ts-ignore
        ref_name: 'main',
      };
      filterJobsByGitHubContext(stubLocalConfigs, context);
    });
  });
});
