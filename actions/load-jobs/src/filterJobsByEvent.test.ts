import { Job } from '@monotonix/schema';
import { filterJobsByEvent } from './filterJobsByEvent';
import { Event } from './schema';

describe('filterJobsByGitHubContext', () => {
  const pushMainJob: Job = {
    app: {
      depends_on: [],
      metadata: {},
    },
    context: {
      dedupe_key: 'refs/heads/main',
      github_ref: 'refs/heads/main',
      app_path: 'apps/hello-world',
      root_dir: 'apps',
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
    metadata: {},
  };
  const pullRequestJob: Job = {
    app: {
      depends_on: [],
      metadata: {},
    },
    context: {
      dedupe_key: 'pr-1',
      github_ref: 'refs/pull/1/merge',
      app_path: 'apps/hello-world',
      root_dir: 'apps',
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
    metadata: {},
  };
  const pullRequestTargetJob: Job = {
    app: {
      depends_on: [],
      metadata: {},
    },
    context: {
      dedupe_key: 'pr-1',
      github_ref: 'refs/heads/main',
      app_path: 'apps/hello-world',
      root_dir: 'apps',
      job_key: 'job1',
      last_commit: {
        hash: '0000000000000000000000000000000000000000',
        timestamp: 0,
      },
      label: '',
    },
    on: {
      pull_request_target: null,
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
    metadata: {},
  };
  const stubLocalConfigs = [pushMainJob, pullRequestJob, pullRequestTargetJob];

  describe('push event', () => {
    it('should return jobs that match the branch', () => {
      const event: Partial<Event> = {
        eventName: 'push',
        ref: 'refs/heads/main',
      };
      expect(
        filterJobsByEvent({
          jobs: stubLocalConfigs,
          // @ts-expect-error
          event,
        }),
      ).toStrictEqual([pushMainJob]);
    });

    it('should not return jobs that do not match the branch', () => {
      const event: Partial<Event> = {
        eventName: 'push',
        ref: 'refs/heads/feature',
      };
      expect(
        filterJobsByEvent({
          jobs: stubLocalConfigs,
          // @ts-expect-error
          event,
        }),
      ).toStrictEqual([]);
    });
  });

  describe('pull_request event', () => {
    describe('when no branches are specified', () => {
      it('always returns jobs for pull_request event', () => {
        const event: Partial<Event> = {
          eventName: 'pull_request',
          payload: {
            pull_request: {
              number: 1,
              base: {
                ref: 'main',
              },
              head: {
                ref: 'feature',
              },
            },
          },
        };
        expect(
          filterJobsByEvent({
            jobs: stubLocalConfigs,
            // @ts-expect-error
            event,
          }),
        ).toStrictEqual([pullRequestJob]);
      });
    });

    describe('when a branch is specified', () => {
      const localConfigsWithBranchSpecified = [
        {
          ...pullRequestJob,
          on: {
            pull_request: {
              branches: ['main'],
            },
          },
        },
      ];
      const pullRequestJobWithBranchSpecified =
        localConfigsWithBranchSpecified[0];

      it('returns jobs that match the branch', () => {
        const event: Partial<Event> = {
          eventName: 'pull_request',
          payload: {
            pull_request: {
              number: 1,
              base: {
                ref: 'main',
              },
              head: {
                ref: 'feature',
              },
            },
          },
        };
        expect(
          filterJobsByEvent({
            jobs: localConfigsWithBranchSpecified,
            // @ts-expect-error
            event,
          }),
        ).toStrictEqual([pullRequestJobWithBranchSpecified]);
      });

      it('does not return jobs that do not match the branch', () => {
        const event: Partial<Event> = {
          eventName: 'pull_request',
          payload: {
            pull_request: {
              number: 1,
              base: {
                ref: 'feature',
              },
              head: {
                ref: 'another-feature',
              },
            },
          },
        };
        expect(
          filterJobsByEvent({
            jobs: localConfigsWithBranchSpecified,
            // @ts-expect-error
            event,
          }),
        ).toStrictEqual([]);
      });
    });
  });

  describe('pull_request_target event', () => {
    describe('when no branches are specified', () => {
      it('always returns jobs for pull_request_target event', () => {
        const event: Partial<Event> = {
          eventName: 'pull_request_target',
          payload: {
            pull_request: {
              number: 1,
              base: {
                ref: 'main',
              },
              head: {
                ref: 'feature',
              },
            },
          },
        };
        expect(
          filterJobsByEvent({
            jobs: stubLocalConfigs,
            // @ts-expect-error
            event,
          }),
        ).toStrictEqual([pullRequestTargetJob]);
      });
    });

    describe('when a branch is specified', () => {
      const localConfigsWithBranchSpecified = [
        {
          ...pullRequestTargetJob,
          on: {
            pull_request_target: {
              branches: ['main'],
            },
          },
        },
      ];
      const pullRequestTargetJobWithBranchSpecified =
        localConfigsWithBranchSpecified[0];

      it('returns jobs that match the branch', () => {
        const event: Partial<Event> = {
          eventName: 'pull_request_target',
          payload: {
            pull_request: {
              number: 1,
              base: {
                ref: 'main',
              },
              head: {
                ref: 'feature',
              },
            },
          },
        };
        expect(
          filterJobsByEvent({
            jobs: localConfigsWithBranchSpecified,
            // @ts-expect-error
            event,
          }),
        ).toStrictEqual([pullRequestTargetJobWithBranchSpecified]);
      });

      it('does not return jobs that do not match the branch', () => {
        const event: Partial<Event> = {
          eventName: 'pull_request_target',
          payload: {
            pull_request: {
              number: 1,
              base: {
                ref: 'feature',
              },
              head: {
                ref: 'another-feature',
              },
            },
          },
        };
        expect(
          filterJobsByEvent({
            jobs: localConfigsWithBranchSpecified,
            // @ts-expect-error
            event,
          }),
        ).toStrictEqual([]);
      });
    });
  });
});
