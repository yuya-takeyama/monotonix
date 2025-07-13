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
  const createAppNameToPath = (jobs: Job[]): Map<string, string> => {
    const map = new Map<string, string>();
    for (const job of jobs) {
      map.set(job.app.name, job.context.app_path);
    }
    return map;
  };

  it('should keep original timestamp when no dependencies', async () => {
    const jobs = [createMockJob('app-a', 100), createMockJob('app-b', 200)];
    const appNameToPath = createAppNameToPath(jobs);

    const result = await calculateEffectiveTimestamps(jobs, appNameToPath);

    const appAJob = result.find(job => job.app.name === 'app-a')!;
    const appBJob = result.find(job => job.app.name === 'app-b')!;

    expect(appAJob.context.last_commit.timestamp).toBe(100);
    expect(appBJob.context.last_commit.timestamp).toBe(200);
  });

  it('should use dependency timestamp when newer', async () => {
    const jobs = [
      createMockJob('shared-lib', 200),
      createMockJob('api-server', 100, ['shared-lib']),
    ];
    const appNameToPath = createAppNameToPath(jobs);

    const result = await calculateEffectiveTimestamps(jobs, appNameToPath);

    const sharedLibJob = result.find(job => job.app.name === 'shared-lib')!;
    const apiServerJob = result.find(job => job.app.name === 'api-server')!;

    expect(sharedLibJob.context.last_commit.timestamp).toBe(200);
    expect(apiServerJob.context.last_commit.timestamp).toBe(200); // Updated from dependency
  });

  it('should keep own timestamp when newer than dependencies', async () => {
    const jobs = [
      createMockJob('shared-lib', 100),
      createMockJob('api-server', 200, ['shared-lib']),
    ];
    const appNameToPath = createAppNameToPath(jobs);

    const result = await calculateEffectiveTimestamps(jobs, appNameToPath);

    const apiServerJob = result.find(job => job.app.name === 'api-server')!;
    expect(apiServerJob.context.last_commit.timestamp).toBe(200); // Keeps own newer timestamp
  });

  it('should handle transitive dependencies', async () => {
    const jobs = [
      createMockJob('core-lib', 300),
      createMockJob('shared-lib', 100, ['core-lib']),
      createMockJob('api-server', 50, ['shared-lib']),
    ];
    const appNameToPath = createAppNameToPath(jobs);

    const result = await calculateEffectiveTimestamps(jobs, appNameToPath);

    const coreLibJob = result.find(job => job.app.name === 'core-lib')!;
    const sharedLibJob = result.find(job => job.app.name === 'shared-lib')!;
    const apiServerJob = result.find(job => job.app.name === 'api-server')!;

    expect(coreLibJob.context.last_commit.timestamp).toBe(300);
    expect(sharedLibJob.context.last_commit.timestamp).toBe(300); // From core-lib
    expect(apiServerJob.context.last_commit.timestamp).toBe(300); // From transitive dependency
  });

  it('should handle multiple dependencies', async () => {
    const jobs = [
      createMockJob('auth-service', 150),
      createMockJob('shared-lib', 200),
      createMockJob('api-server', 100, ['shared-lib', 'auth-service']),
    ];
    const appNameToPath = createAppNameToPath(jobs);

    const result = await calculateEffectiveTimestamps(jobs, appNameToPath);

    const apiServerJob = result.find(job => job.app.name === 'api-server')!;
    expect(apiServerJob.context.last_commit.timestamp).toBe(200); // Max of dependencies
  });

  it('should handle multiple jobs per app', async () => {
    const jobs = [
      createMockJob('shared-lib', 200, undefined, 'build'),
      createMockJob('shared-lib', 180, undefined, 'test'),
      createMockJob('api-server', 100, ['shared-lib'], 'build'),
      createMockJob('api-server', 120, ['shared-lib'], 'test'),
    ];
    const appNameToPath = createAppNameToPath(jobs);

    const result = await calculateEffectiveTimestamps(jobs, appNameToPath);

    // All api-server jobs should have the same effective timestamp (200)
    const apiServerJobs = result.filter(job => job.app.name === 'api-server');
    expect(apiServerJobs).toHaveLength(2);
    
    const apiServerBuildJob = apiServerJobs.find(job => job.context.job_key === 'build')!;
    const apiServerTestJob = apiServerJobs.find(job => job.context.job_key === 'test')!;
    
    expect(apiServerBuildJob.context.last_commit.timestamp).toBe(200);
    expect(apiServerTestJob.context.last_commit.timestamp).toBe(200);
  });

  it('should throw error for circular dependencies', async () => {
    const jobs = [
      createMockJob('app-a', 100, ['app-b']),
      createMockJob('app-b', 200, ['app-a']),
    ];
    const appNameToPath = createAppNameToPath(jobs);

    await expect(calculateEffectiveTimestamps(jobs, appNameToPath)).rejects.toThrow(
      'Circular dependency detected',
    );
  });

  it('should handle missing dependency gracefully when path not known', async () => {
    const jobs = [createMockJob('api-server', 100, ['missing-app'])];
    const appNameToPath = createAppNameToPath(jobs);
    // Don't add missing-app to appNameToPath

    const result = await calculateEffectiveTimestamps(jobs, appNameToPath);
    
    // Should not throw error and use timestamp 0 for missing dependency
    const apiServerJob = result.find(job => job.app.name === 'api-server')!;
    expect(apiServerJob.context.last_commit.timestamp).toBe(100); // Keeps own timestamp
  });
});
