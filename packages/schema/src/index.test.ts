import { GlobalConfigSchema, JobConfigsSchema } from './index';

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
        /Expected object, received string/,
      );
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
      expect(() => JobConfigsSchema.parse(input)).toThrow(/Expected object/);
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
      expect(() => JobConfigsSchema.parse(input)).toThrow(/Expected object/);
    });
  });
});
