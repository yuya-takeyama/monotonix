import { GlobalConfig, Jobs } from '@monotonix/schema';
import { MetadataValidator } from './validateMetadata';

describe('MetadataValidator', () => {
  describe('without metadata schemas', () => {
    it('does not validate when no schemas are defined', () => {
      const globalConfig: GlobalConfig = {
        job_types: {},
      };
      const validator = new MetadataValidator(globalConfig);

      const jobs: Jobs = [
        {
          app: {
            depends_on: [],
            metadata: { any: 'value' },
          },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test',
            root_dir: '.',
            job_key: 'test',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test / test',
          },
          on: {},
          configs: {},
          params: {},
          metadata: { priority: 'high' },
        },
      ];

      expect(() => validator.validateJobs(jobs)).not.toThrow();
    });
  });

  describe('with app metadata schema', () => {
    const globalConfig: GlobalConfig = {
      job_types: {},
      metadata_schemas: {
        app: {
          type: 'object',
          required: ['team', 'owner'],
          properties: {
            team: {
              type: 'string',
              enum: ['platform', 'backend', 'frontend'],
            },
            owner: {
              type: 'string',
              pattern: '^@[a-zA-Z0-9-]+$',
            },
          },
        },
      },
    };

    it('validates valid app metadata', () => {
      const validator = new MetadataValidator(globalConfig);
      const jobs: Jobs = [
        {
          app: {
            depends_on: [],
            metadata: {
              team: 'platform',
              owner: '@yuya-takeyama',
            },
          },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test',
            root_dir: '.',
            job_key: 'test',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test / test',
          },
          on: {},
          configs: {},
          params: {},
        },
      ];

      expect(() => validator.validateJobs(jobs)).not.toThrow();
    });

    it('throws on invalid app metadata', () => {
      const validator = new MetadataValidator(globalConfig);
      const jobs: Jobs = [
        {
          app: {
            depends_on: [],
            metadata: {
              team: 'invalid-team',
              owner: 'not-a-github-username',
            },
          },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test',
            root_dir: '.',
            job_key: 'test',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test / test',
          },
          on: {},
          configs: {},
          params: {},
        },
      ];

      expect(() => validator.validateJobs(jobs)).toThrow(
        /Invalid app metadata for apps\/test/,
      );
    });

    it('throws on missing required fields', () => {
      const validator = new MetadataValidator(globalConfig);
      const jobs: Jobs = [
        {
          app: {
            depends_on: [],
            metadata: {
              team: 'platform',
              // missing owner
            },
          },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test',
            root_dir: '.',
            job_key: 'test',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test / test',
          },
          on: {},
          configs: {},
          params: {},
        },
      ];

      expect(() => validator.validateJobs(jobs)).toThrow(
        /Invalid app metadata for apps\/test/,
      );
    });
  });

  describe('with job metadata schema', () => {
    const globalConfig: GlobalConfig = {
      job_types: {},
      metadata_schemas: {
        job: {
          type: 'object',
          properties: {
            priority: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low'],
            },
            retry_count: {
              type: 'integer',
              minimum: 0,
              maximum: 5,
            },
          },
        },
      },
    };

    it('validates valid job metadata', () => {
      const validator = new MetadataValidator(globalConfig);
      const jobs: Jobs = [
        {
          app: { depends_on: [] },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test',
            root_dir: '.',
            job_key: 'test',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test / test',
          },
          on: {},
          configs: {},
          params: {},
          metadata: {
            priority: 'high',
            retry_count: 3,
          },
        },
      ];

      expect(() => validator.validateJobs(jobs)).not.toThrow();
    });

    it('throws on invalid job metadata', () => {
      const validator = new MetadataValidator(globalConfig);
      const jobs: Jobs = [
        {
          app: { depends_on: [] },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test',
            root_dir: '.',
            job_key: 'test',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test / test',
          },
          on: {},
          configs: {},
          params: {},
          metadata: {
            priority: 'invalid-priority',
            retry_count: 10,
          },
        },
      ];

      expect(() => validator.validateJobs(jobs)).toThrow(
        /Invalid job metadata for test \/ test/,
      );
    });
  });

  describe('with both app and job metadata schemas', () => {
    it('validates multiple jobs with mixed metadata', () => {
      const globalConfig: GlobalConfig = {
        job_types: {},
        metadata_schemas: {
          app: {
            type: 'object',
            properties: {
              team: { type: 'string' },
            },
          },
          job: {
            type: 'object',
            properties: {
              priority: { type: 'string' },
            },
          },
        },
      };

      const validator = new MetadataValidator(globalConfig);
      const jobs: Jobs = [
        {
          app: {
            depends_on: [],
            metadata: { team: 'platform' },
          },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test1',
            root_dir: '.',
            job_key: 'test1',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test1 / test1',
          },
          on: {},
          configs: {},
          params: {},
          metadata: { priority: 'high' },
        },
        {
          app: {
            depends_on: [],
            metadata: { team: 'backend' },
          },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test2',
            root_dir: '.',
            job_key: 'test2',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test2 / test2',
          },
          on: {},
          configs: {},
          params: {},
          metadata: { priority: 'low' },
        },
      ];

      expect(() => validator.validateJobs(jobs)).not.toThrow();
    });

    it('collects all validation errors', () => {
      const globalConfig: GlobalConfig = {
        job_types: {},
        metadata_schemas: {
          app: {
            type: 'object',
            required: ['team'],
            properties: {
              team: { type: 'string' },
            },
          },
          job: {
            type: 'object',
            required: ['priority'],
            properties: {
              priority: { type: 'string' },
            },
          },
        },
      };

      const validator = new MetadataValidator(globalConfig);
      const jobs: Jobs = [
        {
          app: {
            depends_on: [],
            metadata: {}, // missing team
          },
          context: {
            dedupe_key: 'test',
            github_ref: 'refs/heads/main',
            app_path: 'apps/test1',
            root_dir: '.',
            job_key: 'test1',
            last_commit: { hash: 'abc', timestamp: 1234567890 },
            label: 'test1 / test1',
          },
          on: {},
          configs: {},
          params: {},
          metadata: {}, // missing priority
        },
      ];

      expect(() => validator.validateJobs(jobs)).toThrow(
        /Metadata validation failed.*apps\/test1.*test1 \/ test1/s,
      );
    });
  });
});
