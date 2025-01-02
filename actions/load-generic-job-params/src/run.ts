import { JobParamsSchema, JobParam } from '@monotonix/schema';

export const run = (jobType: string, jobParams: string): JobParam[] => {
  return JobParamsSchema.parse(JSON.parse(jobParams)).map(jobParam => {
    const config = jobParam.configs[jobType];
    return {
      ...jobParam,
      params: {
        ...jobParam.params,
        ...(config ? { [jobType]: config } : {}),
      },
    };
  });
};
