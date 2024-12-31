import { run } from './run';
import { JobConfig } from '@monotonix/schema';

describe('run', () => {
  const baseJobConfig: JobConfig = {
    app: {
      name: 'test-app',
    },
    app_context: {
      path: 'apps/test-app',
    },
    on: {
      push: {
        branches: ['main'],
      },
    },
    type: 'base',
    config: {},
    keys: [],
  };

  it('returns job params for matching job type', () => {
    const jobType = 'build';
    const jobConfigs: JobConfig[] = [
      {
        ...baseJobConfig,
        type: 'build',
        config: { key: 'build config' },
      },
      {
        ...baseJobConfig,
        type: 'deploy',
        config: { key: 'deploy config' },
      },
    ];

    const result = run(jobType, JSON.stringify(jobConfigs));

    expect(result.map(jobParam => jobParam.param)).toEqual([
      { key: 'build config' },
    ]);
  });

  it('returns an empty array for no matching job type', () => {
    const jobType = 'test';
    const jobConfigs: JobConfig[] = [
      {
        ...baseJobConfig,
        type: 'build',
        config: { key: 'build config' },
      },
      {
        ...baseJobConfig,
        type: 'deploy',
        config: { key: 'deploy config' },
      },
    ];

    const result = run(jobType, JSON.stringify(jobConfigs));

    expect(result).toEqual([]);
  });

  it('throws an error for invalid job configs', () => {
    const jobType = 'build';
    const jobConfigs = 'invalid json';

    expect(() => run(jobType, jobConfigs)).toThrow(/not valid JSON/);
  });
});
