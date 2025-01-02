import { createJob } from './loadJobsFromLocalConfigs';
import { Context } from '@actions/github/lib/context';
import { Job, LocalConfig, LocalConfigJob } from '@monotonix/schema';

describe('createJob', () => {
  // @ts-ignore
  const stubContext = {
    ref: 'refs/heads/main',
  } as Context;

  const stubJob: LocalConfigJob = {
    on: {
      push: {
        branches: ['main'],
      },
    },
    configs: {
      generic: {
        foo: 'FOO',
      },
    },
  };

  const stubLocalConfig: LocalConfig = {
    app: {
      name: 'test-app',
    },
    jobs: {
      job1: stubJob,
    },
  };

  const stubCommitInfo = {
    hash: '0000000000000000000000000000000000000000',
    timestamp: 0,
  };

  it('creates a job config with the correct structure', () => {
    const appPath = '/root/subdir';
    const jobKey = 'job1';

    const result = createJob({
      localConfig: stubLocalConfig,
      workflowId: 'docker_build',
      appPath,
      lastCommit: stubCommitInfo,
      jobKey,
      job: stubJob,
      githubContext: stubContext,
    });

    const expected: Job = {
      app: {
        name: 'test-app',
      },
      context: {
        workflow_id: 'docker_build',
        github_ref: stubContext.ref,
        app_path: appPath,
        job_key: jobKey,
        last_commit: stubCommitInfo,
        label: 'test-app / job1',
      },
      on: {
        push: {
          branches: ['main'],
        },
      },
      configs: {
        generic: {
          foo: 'FOO',
        },
      },
      params: {},
    };

    expect(result).toEqual(expected);
  });

  it('handles different job configurations', () => {
    const appPath = '/root/subdir';
    const jobKey = 'job2';
    const differentJob: LocalConfigJob = {
      on: {
        pull_request: null,
      },
      configs: {
        generic: {
          bar: 'BAR',
        },
      },
    };

    const result = createJob({
      localConfig: stubLocalConfig,
      workflowId: 'docker_build',
      appPath,
      lastCommit: stubCommitInfo,
      jobKey,
      job: differentJob,
      githubContext: stubContext,
    });

    const expected: Job = {
      app: {
        name: 'test-app',
      },
      context: {
        workflow_id: 'docker_build',
        github_ref: stubContext.ref,
        app_path: appPath,
        job_key: jobKey,
        last_commit: stubCommitInfo,
        label: 'test-app / job2',
      },
      on: {
        pull_request: null,
      },
      configs: {
        generic: {
          bar: 'BAR',
        },
      },
      params: {},
    };

    expect(result).toEqual(expected);
  });
});
