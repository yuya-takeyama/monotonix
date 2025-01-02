import { Context } from '@actions/github/lib/context';
import { filterJobParamsByGitHubContext } from './filterJobConfigsByGitHubContext';
import { JobParam } from '@monotonix/schema';

describe('filterJobConfigsByGitHubContext', () => {
  const pushMainJobConfig: JobParam = {
    app: {
      name: 'hello-world',
    },
    app_context: {
      path: 'apps/hello-world',
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
    configs: {
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
    params: {},
    keys: [],
  };
  const pullRequestJobConfig: JobParam = {
    app: {
      name: 'hello-world',
    },
    app_context: {
      path: 'apps/hello-world',
      last_commit: {
        hash: '0000000000000000000000000000000000000000',
        timestamp: 0,
      },
      label: '',
    },
    on: {
      pull_request: null,
    },
    configs: {
      generic: {
        foo: 'FOO',
      },
    },
    params: {
      generic: {
        foo: 'FOO',
      },
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
        filterJobParamsByGitHubContext({
          jobParams: stubLocalConfigs,
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
        filterJobParamsByGitHubContext({
          jobParams: stubLocalConfigs,
          context,
        }),
      ).toStrictEqual([]);
    });
  });
});
