import { calculateEffectiveTimestamps } from './calculateEffectiveTimestamp';
import { Job } from '@monotonix/schema';

const createMockJob = (
  appName: string,
  timestamp: number,
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
      timestamp,
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

describe('calculateEffectiveTimestamps', () => {
  it('should keep original timestamp when no dependencies', () => {
    const jobs = [
      createMockJob('app-a', 100),
      createMockJob('app-b', 200),
    ];

    const result = calculateEffectiveTimestamps(jobs);

    expect(result[0]!.context.last_commit.timestamp).toBe(100);
    expect(result[1]!.context.last_commit.timestamp).toBe(200);
  });

  it('should use dependency timestamp when newer', () => {
    const jobs = [
      createMockJob('shared-lib', 200),
      createMockJob('api-server', 100, ['shared-lib']),
    ];

    const result = calculateEffectiveTimestamps(jobs);

    const sharedLibJob = result.find(job => job.app.name === 'shared-lib')!;
    const apiServerJob = result.find(job => job.app.name === 'api-server')!;

    expect(sharedLibJob.context.last_commit.timestamp).toBe(200);
    expect(apiServerJob.context.last_commit.timestamp).toBe(200); // Updated from dependency
  });

  it('should keep own timestamp when newer than dependencies', () => {
    const jobs = [
      createMockJob('shared-lib', 100),
      createMockJob('api-server', 200, ['shared-lib']),
    ];

    const result = calculateEffectiveTimestamps(jobs);

    const apiServerJob = result.find(job => job.app.name === 'api-server')!;
    expect(apiServerJob.context.last_commit.timestamp).toBe(200); // Keeps own newer timestamp
  });

  it('should handle transitive dependencies', () => {
    const jobs = [
      createMockJob('core-lib', 300),
      createMockJob('shared-lib', 100, ['core-lib']),
      createMockJob('api-server', 50, ['shared-lib']),
    ];

    const result = calculateEffectiveTimestamps(jobs);

    const coreLibJob = result.find(job => job.app.name === 'core-lib')!;
    const sharedLibJob = result.find(job => job.app.name === 'shared-lib')!;
    const apiServerJob = result.find(job => job.app.name === 'api-server')!;

    expect(coreLibJob.context.last_commit.timestamp).toBe(300);
    expect(sharedLibJob.context.last_commit.timestamp).toBe(300); // From core-lib
    expect(apiServerJob.context.last_commit.timestamp).toBe(300); // From transitive dependency
  });

  it('should handle multiple dependencies', () => {
    const jobs = [
      createMockJob('auth-service', 150),
      createMockJob('shared-lib', 200),
      createMockJob('api-server', 100, ['shared-lib', 'auth-service']),
    ];

    const result = calculateEffectiveTimestamps(jobs);

    const apiServerJob = result.find(job => job.app.name === 'api-server')!;
    expect(apiServerJob.context.last_commit.timestamp).toBe(200); // Max of dependencies
  });

  it('should handle multiple jobs per app', () => {
    const jobs = [
      createMockJob('shared-lib', 200, undefined, 'build'),
      createMockJob('shared-lib', 180, undefined, 'test'),
      createMockJob('api-server', 100, ['shared-lib'], 'build'),
      createMockJob('api-server', 120, ['shared-lib'], 'test'),
    ];

    const result = calculateEffectiveTimestamps(jobs);

    // All api-server jobs should have the same effective timestamp (200)
    const apiServerJobs = result.filter(job => job.app.name === 'api-server');
    expect(apiServerJobs).toHaveLength(2);
    expect(apiServerJobs[0]!.context.last_commit.timestamp).toBe(200);
    expect(apiServerJobs[1]!.context.last_commit.timestamp).toBe(200);
  });

  it('should throw error for circular dependencies', () => {
    const jobs = [
      createMockJob('app-a', 100, ['app-b']),
      createMockJob('app-b', 200, ['app-a']),
    ];

    expect(() => calculateEffectiveTimestamps(jobs)).toThrow('Circular dependency detected');
  });

  it('should throw error for missing dependency', () => {
    const jobs = [
      createMockJob('api-server', 100, ['missing-app']),
    ];

    expect(() => calculateEffectiveTimestamps(jobs)).toThrow("Dependency app 'missing-app' not found");
  });
});