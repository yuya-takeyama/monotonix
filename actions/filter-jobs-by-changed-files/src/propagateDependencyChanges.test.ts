import { propagateDependencyChanges } from './propagateDependencyChanges';
import { Job } from '@monotonix/schema';

const createMockJob = (
  appName: string,
  dependsOn?: string[],
  jobKey = 'build',
): Job => ({
  app: {
    name: appName,
    depends_on: dependsOn,
  },
  context: {
    dedupe_key: 'test',
    github_ref: 'refs/heads/main',
    app_path: `apps/${appName}`,
    job_key: jobKey,
    last_commit: {
      hash: 'abc123',
      timestamp: 1234567890,
    },
    label: `${appName} / ${jobKey}`,
  },
  on: {
    push: { branches: ['main'] },
    pull_request: null,
    pull_request_target: null,
  },
  configs: {},
  params: {},
});

describe('propagateDependencyChanges', () => {
  it('should return original jobs when no dependencies exist', () => {
    const jobs = [createMockJob('app-a'), createMockJob('app-b')];
    const changedJobs = [createMockJob('app-a')];

    const result = propagateDependencyChanges(jobs, changedJobs);

    expect(result).toEqual(changedJobs);
  });

  it('should include dependent apps when dependency changes', () => {
    const jobs = [
      createMockJob('shared-lib'),
      createMockJob('api-server', ['shared-lib']),
      createMockJob('web-app'),
    ];
    const changedJobs = [createMockJob('shared-lib')];

    const result = propagateDependencyChanges(jobs, changedJobs);

    expect(result).toHaveLength(2);
    expect(result.map(job => job.app.name)).toContain('shared-lib');
    expect(result.map(job => job.app.name)).toContain('api-server');
  });

  it('should handle multiple dependencies', () => {
    const jobs = [
      createMockJob('shared-lib'),
      createMockJob('auth-service'),
      createMockJob('api-server', ['shared-lib', 'auth-service']),
    ];
    const changedJobs = [createMockJob('shared-lib')];

    const result = propagateDependencyChanges(jobs, changedJobs);

    expect(result).toHaveLength(2);
    expect(result.map(job => job.app.name)).toContain('shared-lib');
    expect(result.map(job => job.app.name)).toContain('api-server');
  });

  it('should handle transitive dependencies', () => {
    const jobs = [
      createMockJob('core-lib'),
      createMockJob('shared-lib', ['core-lib']),
      createMockJob('api-server', ['shared-lib']),
    ];
    const changedJobs = [createMockJob('core-lib')];

    const result = propagateDependencyChanges(jobs, changedJobs);

    expect(result).toHaveLength(3);
    expect(result.map(job => job.app.name)).toContain('core-lib');
    expect(result.map(job => job.app.name)).toContain('shared-lib');
    expect(result.map(job => job.app.name)).toContain('api-server');
  });

  it('should include all jobs for dependent apps', () => {
    const jobs = [
      createMockJob('shared-lib', undefined, 'build'),
      createMockJob('api-server', ['shared-lib'], 'build'),
      createMockJob('api-server', ['shared-lib'], 'test'),
    ];
    const changedJobs = [createMockJob('shared-lib', undefined, 'build')];

    const result = propagateDependencyChanges(jobs, changedJobs);

    expect(result).toHaveLength(3);
    const apiServerJobs = result.filter(job => job.app.name === 'api-server');
    expect(apiServerJobs).toHaveLength(2);
    expect(apiServerJobs.map(job => job.context.job_key)).toContain('build');
    expect(apiServerJobs.map(job => job.context.job_key)).toContain('test');
  });

  it('should not duplicate jobs', () => {
    const jobs = [
      createMockJob('shared-lib'),
      createMockJob('api-server', ['shared-lib']),
    ];
    const changedJobs = [
      createMockJob('shared-lib'),
      createMockJob('api-server', ['shared-lib']),
    ];

    const result = propagateDependencyChanges(jobs, changedJobs);

    expect(result).toHaveLength(2);
    expect(result.map(job => job.app.name)).toContain('shared-lib');
    expect(result.map(job => job.app.name)).toContain('api-server');
  });

  it('should handle playground scenario: foo changes triggers foo/cmd/api-server', () => {
    const jobs = [
      // foo app with go_test job
      createMockJob('foo', undefined, 'go_test'),
      // foo/cmd/api-server with multiple jobs and depends on foo
      createMockJob('foo/cmd/api-server', ['foo'], 'build_prd'),
      createMockJob('foo/cmd/api-server', ['foo'], 'build_dev_main'),
      createMockJob('foo/cmd/api-server', ['foo'], 'build_dev_pr'),
    ];
    // Only foo's job is initially changed (from file path filter)
    const changedJobs = [createMockJob('foo', undefined, 'go_test')];

    const result = propagateDependencyChanges(jobs, changedJobs);

    expect(result).toHaveLength(4); // 1 foo job + 3 foo/cmd/api-server jobs
    expect(result.map(job => job.app.name)).toContain('foo');
    expect(result.map(job => job.app.name)).toContain('foo/cmd/api-server');
    
    // Should include all foo/cmd/api-server jobs
    const apiServerJobs = result.filter(job => job.app.name === 'foo/cmd/api-server');
    expect(apiServerJobs).toHaveLength(3);
    expect(apiServerJobs.map(job => job.context.job_key)).toContain('build_prd');
    expect(apiServerJobs.map(job => job.context.job_key)).toContain('build_dev_main');
    expect(apiServerJobs.map(job => job.context.job_key)).toContain('build_dev_pr');
  });
});
