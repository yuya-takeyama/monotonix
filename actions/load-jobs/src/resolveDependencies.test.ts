import { resolveDependencies } from './resolveDependencies';
import { Job } from '@monotonix/schema';

const createMockJob = (appName: string, dependsOn?: string[]): Job => ({
  app: {
    name: appName,
    depends_on: dependsOn,
  },
  context: {
    dedupe_key: 'test',
    github_ref: 'refs/heads/main',
    app_path: `apps/${appName}`,
    job_key: 'build',
    last_commit: {
      hash: 'abc123',
      timestamp: 1234567890,
    },
    label: `${appName} / build`,
  },
  on: {
    push: { branches: ['main'] },
    pull_request: null,
    pull_request_target: null,
  },
  configs: {},
  params: {},
});

describe('resolveDependencies', () => {
  it('should return jobs in dependency order', () => {
    const jobs = [
      createMockJob('app-c', ['app-b']),
      createMockJob('app-a'),
      createMockJob('app-b', ['app-a']),
    ];

    const resolved = resolveDependencies(jobs);

    expect(resolved.map(job => job.app.name)).toEqual(['app-a', 'app-b', 'app-c']);
  });

  it('should handle jobs with no dependencies', () => {
    const jobs = [
      createMockJob('app-a'),
      createMockJob('app-b'),
    ];

    const resolved = resolveDependencies(jobs);

    expect(resolved).toHaveLength(2);
    expect(resolved.map(job => job.app.name)).toContain('app-a');
    expect(resolved.map(job => job.app.name)).toContain('app-b');
  });

  it('should throw error for circular dependencies', () => {
    const jobs = [
      createMockJob('app-a', ['app-b']),
      createMockJob('app-b', ['app-a']),
    ];

    expect(() => resolveDependencies(jobs)).toThrow('Circular dependency detected');
  });

  it('should throw error for missing dependency', () => {
    const jobs = [
      createMockJob('app-a', ['app-missing']),
    ];

    expect(() => resolveDependencies(jobs)).toThrow("Dependency app 'app-missing' not found");
  });

  it('should handle complex dependency chains', () => {
    const jobs = [
      createMockJob('app-d', ['app-c']),
      createMockJob('app-b', ['app-a']),
      createMockJob('app-c', ['app-a', 'app-b']),
      createMockJob('app-a'),
    ];

    const resolved = resolveDependencies(jobs);

    expect(resolved.map(job => job.app.name)).toEqual(['app-a', 'app-b', 'app-c', 'app-d']);
  });
});