import {
  GlobalConfigSchema,
  JobConfigsSchema,
  LocalConfigSchema,
} from './index';

describe('GlobalConfigSchema', () => {
  it('drops non-allowed keys', () => {
    const input = {
      job_types: {},
      foo: 'bar',
      baz: 'qux',
    };
    const result = GlobalConfigSchema.parse(input);
    expect(result).toEqual({ job_types: {} });
  });

  describe('job_types', () => {
    it('accepts valid input', () => {
      const input = {
        job_types: {
          docker_build: {},
          plain: {},
        },
      };
      const result = GlobalConfigSchema.parse(input);
      expect(result).toEqual({
        job_types: {
          docker_build: {},
          plain: {},
        },
      });
    });

    it('only accepts objects', () => {
      const input = {
        job_types: {
          docker_build: {},
          plain: '',
        },
      };
      expect(() => GlobalConfigSchema.parse(input)).toThrow(
        /expected object, received string/i,
      );
    });
  });

  describe('metadata_schemas', () => {
    it('accepts metadata schema definitions', () => {
      const input = {
        job_types: {},
        metadata_schemas: {
          app: {
            type: 'object',
            properties: {
              team: { type: 'string' },
              owner: { type: 'string' },
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
      const result = GlobalConfigSchema.parse(input);
      expect(result.metadata_schemas).toEqual(input.metadata_schemas);
    });

    it('accepts missing metadata_schemas', () => {
      const input = {
        job_types: {},
      };
      const result = GlobalConfigSchema.parse(input);
      expect(result.metadata_schemas).toBeUndefined();
    });

    it('accepts empty metadata_schemas', () => {
      const input = {
        job_types: {},
        metadata_schemas: {},
      };
      const result = GlobalConfigSchema.parse(input);
      expect(result.metadata_schemas).toEqual({});
    });
  });

  describe('JobConfigsSchema', () => {
    it('accepts empty object', () => {
      const input = {};
      const result = JobConfigsSchema.parse(input);
      expect(result).toEqual({});
    });

    it('accepts nested objects with any values', () => {
      const input = {
        build: {
          docker: {
            image: 'node:16',
            args: ['--build-arg', 'FOO=bar'],
            cache: true,
          },
        },
        deploy: {
          kubernetes: {
            namespace: 'production',
            replicas: 3,
            config: {
              memory: '512Mi',
              cpu: '200m',
            },
          },
        },
      };
      const result = JobConfigsSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('accepts objects with any value types', () => {
      const input = {
        test: {
          string: 'value',
          number: 123,
          boolean: true,
          array: [1, 2, 3],
          null: null,
          object: { foo: 'bar' },
        },
      };
      const result = JobConfigsSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('rejects non-object at top level', () => {
      const input = 'not-an-object';
      expect(() => JobConfigsSchema.parse(input)).toThrow(/expected object/i);
    });

    it('allows null at first nested level', () => {
      const input = {
        config: null,
      };
      const result = JobConfigsSchema.parse(input);
      expect(result).toEqual(input);
    });

    it('rejects non-object and non-null at first nested level', () => {
      const input = {
        config: 'not-an-object',
      };
      expect(() => JobConfigsSchema.parse(input)).toThrow(/expected object/i);
    });
  });
});

describe('LocalConfigSchema - Default Values', () => {
  it('applies default values when app field is missing', () => {
    const input = {
      jobs: {},
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.app).toEqual({
      depends_on: [],
      metadata: {},
    });
  });

  it('applies default metadata when app exists but metadata is missing', () => {
    const input = {
      app: {
        depends_on: ['apps/shared'],
      },
      jobs: {},
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.app.metadata).toEqual({});
  });

  it('applies default depends_on when app exists but depends_on is missing', () => {
    const input = {
      app: {
        metadata: {
          team: 'platform',
        },
      },
      jobs: {},
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.app.depends_on).toEqual([]);
  });

  it('applies default metadata to jobs when missing', () => {
    const input = {
      jobs: {
        build: {
          on: {
            push: {
              branches: ['main'],
            },
          },
          configs: {},
        },
      },
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.jobs.build?.metadata).toEqual({});
  });
});

describe('LocalConfigSchema - Metadata Support', () => {
  it('accepts app metadata', () => {
    const input = {
      app: {
        depends_on: [],
        metadata: {
          team: 'platform',
          owner: '@yuya-takeyama',
          tier: 1,
          custom_field: 'any_value',
        },
      },
      jobs: {},
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.app?.metadata).toEqual(input.app.metadata);
  });

  it('accepts job metadata', () => {
    const input = {
      jobs: {
        build_prd: {
          on: {
            push: {
              branches: ['main'],
            },
          },
          configs: {
            docker_build: {
              registry: 'ecr',
            },
          },
          metadata: {
            priority: 'critical',
            alert_on_failure: true,
            retry_count: 3,
          },
        },
      },
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.jobs.build_prd?.metadata).toEqual(
      input.jobs.build_prd.metadata,
    );
  });

  it('applies default empty object for missing metadata', () => {
    const input = {
      app: {
        depends_on: [],
      },
      jobs: {
        test: {
          on: { push: { branches: ['main'] } },
          configs: {},
        },
      },
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.app?.metadata).toEqual({});
    expect(result.jobs.test?.metadata).toEqual({});
  });

  it('accepts any metadata structure', () => {
    const input = {
      app: {
        depends_on: [],
        metadata: {
          nested: {
            deeply: {
              nested: 'value',
            },
          },
          array: [1, 2, 3],
          boolean: true,
          number: 42,
        },
      },
      jobs: {},
    };
    const result = LocalConfigSchema.parse(input);
    expect(result.app?.metadata).toEqual(input.app.metadata);
  });
});
