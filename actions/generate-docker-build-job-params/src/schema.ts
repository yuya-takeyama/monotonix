import {
  GlobalConfigSchema,
  JobConfigSchema,
  JobParamSchema,
} from '@monotonix/schema';
import { z } from 'zod';

export const DockerBuildGlobalConfigSchema = GlobalConfigSchema.extend({
  job_types: z.object({
    docker_build: z.object({
      registries: z.object({
        aws: z.object({
          iams: z.record(
            z.string(),
            z.object({
              role: z.string(),
              region: z.string(),
            }),
          ),
          repositories: z.record(
            z.string(),
            z.object({
              type: z.enum(['private', 'public']).default('private'),
              base_url: z.string(),
            }),
          ),
        }),
      }),
    }),
  }),
});

export type DockerBuildGlobalConfig = z.infer<
  typeof DockerBuildGlobalConfigSchema
>;

export const DockerBuildJobConfigSchema = JobConfigSchema.extend({
  config: z.object({
    registry: z.object({
      type: z.literal('aws'),
      aws: z.object({
        iam: z.string(),
        repository: z.string(),
      }),
    }),
    tagging: z.enum(['always_latest', 'semver_datetime']),
    platforms: z.array(z.string()),
  }),
});

export type DockerBuildJobConfig = z.infer<typeof DockerBuildJobConfigSchema>;

export const DockerBuildJobParamSchema = JobParamSchema.extend({
  param: z.object({
    registry: z.object({
      type: z.literal('aws'),
      aws: z.object({
        iam: z.object({
          role: z.string(),
          region: z.string(),
        }),
        repository: z.object({
          type: z.enum(['private', 'public']),
        }),
      }),
    }),
    context: z.string(),
    tags: z.string(),
    platforms: z.string(),
  }),
});

export type DockerBuildJobParam = z.infer<typeof DockerBuildJobParamSchema>;
