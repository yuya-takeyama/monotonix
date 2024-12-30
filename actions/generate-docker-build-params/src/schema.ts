import {
  GlobalConfigSchema,
  JobSchema,
  BaseBuildParamSchema,
} from '@monotonix/schema';
import { z } from 'zod';

export const DockerBuildGlobalConfigSchema = GlobalConfigSchema.extend({
  loaders: z.object({
    docker_build: z.object({
      environment: z.object({
        type: z.literal('aws'),
        aws: z.object({
          identities: z.record(
            z.string(),
            z.object({
              iam_role: z.string(),
              region: z.string(),
            }),
          ),
          registries: z.record(
            z.string(),
            z.object({
              identity: z.string(),
              type: z.enum(['private', 'public']).default('private').optional(),
              region: z.string(),
              repository_base: z.string(),
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

export const DockerBuildJobSchema = JobSchema.extend({
  config: z.object({
    loader: z.literal('docker_build'),
    environment: z.object({
      type: z.literal('aws'),
      aws: z.object({
        identity: z.string(),
        registry: z.string(),
      }),
    }),
    tagging: z.enum(['always_latest', 'semver_datetime']),
    platforms: z.array(z.string()),
  }),
});

export type DockerBuildJob = z.infer<typeof DockerBuildJobSchema>;

export const DockerBuildParamSchema = BaseBuildParamSchema.extend({
  param: z.object({
    environment: z.object({
      type: z.literal('aws'),
      aws: z.object({
        identity: z.object({
          iam_role: z.string(),
          region: z.string(),
        }),
        registry: z.object({
          type: z.enum(['private', 'public']),
          region: z.string(),
        }),
      }),
    }),
    context: z.string(),
    tags: z.string(),
    platforms: z.string(),
  }),
});

export type DockerBuildParam = z.infer<typeof DockerBuildParamSchema>;
