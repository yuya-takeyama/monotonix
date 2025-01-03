import { GlobalConfigSchema } from './index';

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
});
