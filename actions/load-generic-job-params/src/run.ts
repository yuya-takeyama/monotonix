import { JobParamsSchema, JobParam } from '@monotonix/schema';

export const run = (configKey: string, jobParams: string): JobParam[] => {
  return JobParamsSchema.parse(JSON.parse(jobParams)).map(jobParam => {
    const config = jobParam.configs[configKey];
    return {
      ...jobParam,
      params: {
        ...jobParam.params,
        ...(config ? { [configKey]: config } : {}),
      },
    };
  });
};
