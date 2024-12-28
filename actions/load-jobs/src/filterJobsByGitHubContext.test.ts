import { Context } from '@actions/github/lib/context';
import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';

describe('filterJobsByGitHubContext', () => {
  const pushMainJobConfig = {
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
  };
  const pullRequestJobConfig = {
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
  };
  const stubLocalConfigs = [pushMainJobConfig, pullRequestJobConfig];

  describe('push event', () => {
    it('should return jobs that match the branch', () => {
      // @ts-ignore
      const context: Context = {
        eventName: 'push',
        ref: 'refs/heads/main',
      };
      expect(
        filterJobsByGitHubContext(stubLocalConfigs, context),
      ).toStrictEqual([pushMainJobConfig]);
    });

    it('should not return jobs that do not match the branch', () => {
      // @ts-ignore
      const context: Context = {
        eventName: 'push',
        ref: 'refs/heads/feature',
      };
      expect(
        filterJobsByGitHubContext(stubLocalConfigs, context),
      ).toStrictEqual([]);
    });
  });
});
