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
});
