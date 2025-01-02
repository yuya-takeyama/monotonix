import { run } from './run';
import { JobParam } from '@monotonix/schema';

describe('run', () => {
  const baseJobConfig: JobParam = {
    app: {
      name: 'test-app',
    },
    app_context: {
      path: 'apps/test-app',
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
    configs: {},
    params: {},
    keys: [],
  };

  it('returns job params with the specified job type config', () => {
    const jobType = 'build';
    const jobConfigs: JobParam[] = [
      {
        ...baseJobConfig,
        configs: {
          build: { key: 'build config' },
        },
      },
      {
        ...baseJobConfig,
        configs: {
          deploy: { key: 'deploy config' },
        },
      },
    ];

    const result = run(jobType, JSON.stringify(jobConfigs));

    expect(result.map(jobParam => jobParam.params)).toEqual([
      { build: { key: 'build config' } },
      {},
    ]);
  });

  it('throws an error for invalid job configs', () => {
    const jobType = 'build';
    const jobConfigs = 'invalid json';

    expect(() => run(jobType, jobConfigs)).toThrow(/not valid JSON/);
  });
});
