import { Context } from '@actions/github/lib/context';
import { filterJobsByGitHubContext } from './filterJobsByGitHubContext';
import { Job } from '@monotonix/schema';

describe('filterJobsByGitHubContext', () => {
  const pushMainJob: Job = {
    app: {
      name: 'hello-world',
    },
    context: {
      dedupe_key: 'refs/heads/main',
      github_ref: 'refs/heads/main',
      app_path: 'apps/hello-world',
      job_key: 'job1',
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
  };
  const pullRequestJob: Job = {
    app: {
      name: 'hello-world',
    },
    context: {
      dedupe_key: 'refs/pull/1/merge',
      github_ref: 'refs/pull/1/merge',
      app_path: 'apps/hello-world',
      job_key: 'job1',
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
  };
  const stubLocalConfigs = [pushMainJob, pullRequestJob];

  describe('push event', () => {
    it('should return jobs that match the branch', () => {
      // @ts-ignore
      const context: Context = {
        eventName: 'push',
        ref: 'refs/heads/main',
      };
      expect(
        filterJobsByGitHubContext({
          jobs: stubLocalConfigs,
          context,
        }),
      ).toStrictEqual([pushMainJob]);
    });

    it('should not return jobs that do not match the branch', () => {
      // @ts-ignore
      const context: Context = {
        eventName: 'push',
        ref: 'refs/heads/feature',
      };
      expect(
        filterJobsByGitHubContext({
          jobs: stubLocalConfigs,
          context,
        }),
      ).toStrictEqual([]);
    });
  });
});
