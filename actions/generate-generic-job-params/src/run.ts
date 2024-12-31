import { z } from 'zod';
import { JobConfigSchema, JobParam } from '@monotonix/schema';

export const run = (jobType: string, jobConfigs: string): JobParam[] => {
  return z
    .array(JobConfigSchema)
    .parse(JSON.parse(jobConfigs))
    .filter(jobConfig => jobConfig.type === jobType)
    .map(jobConfig => {
      return {
        ...jobConfig,
        param: jobConfig.config,
      };
    });
};
