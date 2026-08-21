import { context } from '@actions/github';
import {
  generateImageReferences,
  generateSemverDatetimeTag,
} from './generateImageReferences';
import { DockerBuildGlobalConfig, InputJob } from './schema';

type Context = typeof context;

describe('generateSemverDatetimeTag', () => {
  const timestamp = 1704067200; // 2024-01-01 00:00:00 UTC

  it('generates tag in UTC timezone', () => {
    const tag = generateSemverDatetimeTag(timestamp, 'UTC');
    expect(tag).toBe('0.0.20240101000000');
  });

  it('generates tag in Asia/Tokyo timezone', () => {
    const tag = generateSemverDatetimeTag(timestamp, 'Asia/Tokyo');
    expect(tag).toBe('0.0.20240101090000');
  });

  it('generates tag in America/Los_Angeles timezone', () => {
    const tag = generateSemverDatetimeTag(timestamp, 'America/Los_Angeles');
    expect(tag).toBe('0.0.20231231160000');
  });

  it('throws error for invalid timezone', () => {
    expect(() => generateSemverDatetimeTag(timestamp, 'invalid')).toThrow(
      'Invalid timezone: invalid',
    );
  });
});

describe('generateImageReferences', () => {
  const gcpGlobalConfig: DockerBuildGlobalConfig = {
    job_types: {
      docker_build: {
        registries: {
          gcp: {
            iams: {
              'some-registry': {
                workload_identity_provider:
                  'projects/123456789/locations/global/workloadIdentityPools/github/providers/my-provider',
                service_account: 'builder@my-project.iam.gserviceaccount.com',
              },
            },
            repositories: {
              'some-registry': {
                base_url:
                  'asia-northeast1-docker.pkg.dev/my-project/my-repository',
              },
            },
          },
        },
      },
    },
  };

  const gcpJob: InputJob = {
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
    configs: {
      docker_build: {
        registry: {
          type: 'gcp',
          gcp: {
            iam: 'some-registry',
            repository: 'some-registry',
          },
        },
        tagging: 'always_latest',
        platforms: ['linux/amd64'],
      },
    },
    on: {
      push: {
        branches: ['main'],
      },
    },
    params: {},
    metadata: {},
  };

  const pushContext = {
    ref: 'refs/heads/main',
    payload: {
      head_commit: {
        timestamp: '2024-01-01T00:00:00Z',
      },
    },
  } as unknown as Context;

  it('generates latest tag for gcp registry', () => {
    expect(
      generateImageReferences({
        context: pushContext,
        globalConfig: gcpGlobalConfig,
        inputJob: gcpJob,
        timezone: 'UTC',
      }),
    ).toEqual([
      'asia-northeast1-docker.pkg.dev/my-project/my-repository/hello-world:latest',
    ]);
  });

  it('generates semver datetime tag for gcp registry', () => {
    const job: InputJob = {
      ...gcpJob,
      configs: {
        ...gcpJob.configs,
        docker_build: {
          ...gcpJob.configs.docker_build,
          tagging: 'semver_datetime',
        },
      },
    };
    expect(
      generateImageReferences({
        context: pushContext,
        globalConfig: gcpGlobalConfig,
        inputJob: job,
        timezone: 'UTC',
      }),
    ).toEqual([
      'asia-northeast1-docker.pkg.dev/my-project/my-repository/hello-world:0.0.20240101000000',
    ]);
  });

  it('generates pull request tag for gcp registry', () => {
    const job: InputJob = {
      ...gcpJob,
      configs: {
        ...gcpJob.configs,
        docker_build: {
          ...gcpJob.configs.docker_build,
          tagging: 'pull_request',
        },
      },
    };
    const prContext = {
      ref: 'refs/pull/123/merge',
      payload: {
        pull_request: {
          number: 123,
        },
      },
    } as unknown as Context;
    expect(
      generateImageReferences({
        context: prContext,
        globalConfig: gcpGlobalConfig,
        inputJob: job,
        timezone: 'UTC',
      }),
    ).toEqual([
      'asia-northeast1-docker.pkg.dev/my-project/my-repository/hello-world:pr-123',
    ]);
  });

  it('throws when gcp repository is not found in global config', () => {
    const job: InputJob = {
      ...gcpJob,
      configs: {
        ...gcpJob.configs,
        docker_build: {
          ...gcpJob.configs.docker_build,
          registry: {
            type: 'gcp',
            gcp: {
              iam: 'some-registry',
              repository: 'unknown',
            },
          },
        },
      },
    };
    expect(() =>
      generateImageReferences({
        context: pushContext,
        globalConfig: gcpGlobalConfig,
        inputJob: job,
        timezone: 'UTC',
      }),
    ).toThrow('Repository not found from Global Config: unknown');
  });
});
