import { GlobalConfigSchema, JobParamSchema } from '@monotonix/schema';
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

const InputJobParamSchema = JobParamSchema.extend({
  configs: JobParamSchema.shape.configs.extend({
    docker_build: z.object({
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
  }),
});

export type InputJobParam = z.infer<typeof InputJobParamSchema>;

export const InputJobParamsSchema = z.array(InputJobParamSchema);

const OutputJobParamSchema = InputJobParamSchema.extend({
  params: InputJobParamSchema.shape.params.extend({
    docker_build: z.object({
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
  }),
});

export type OutputJobParam = z.infer<typeof OutputJobParamSchema>;
