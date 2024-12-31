import { Context } from '@actions/github/lib/context';
import { filterJobConfigsByGitHubContext } from './filterJobConfigsByGitHubContext';
import { JobConfig } from '@monotonix/schema';

describe('filterJobConfigsByGitHubContext', () => {
  const pushMainJobConfig: JobConfig = {
    app: {
      name: 'hello-world',
    },
    app_context: {
      path: 'apps/hello-world',
    },
    on: {
      push: {
        branches: ['main'],
      },
    },
    type: 'docker_build',
    config: {
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
    keys: [],
  };
  const pullRequestJobConfig: JobConfig = {
    app: {
      name: 'hello-world',
    },
    app_context: {
      path: 'apps/hello-world',
    },
    on: {
      pull_request: null,
    },
    type: 'docker_build',
    config: {
      platform: {
        type: 'aws',
        aws: {
          identity: 'dev_main',
          registry: 'dev_main',
        },
      },
      tagging: 'always_latest',
      platforms: ['linux/amd64'],
    },
    keys: [],
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
        filterJobConfigsByGitHubContext({
          jobConfigs: stubLocalConfigs,
          context,
        }),
      ).toStrictEqual([pushMainJobConfig]);
    });

    it('should not return jobs that do not match the branch', () => {
      // @ts-ignore
      const context: Context = {
        eventName: 'push',
        ref: 'refs/heads/feature',
      };
      expect(
        filterJobConfigsByGitHubContext({
          jobConfigs: stubLocalConfigs,
          context,
        }),
      ).toStrictEqual([]);
    });
  });
});
