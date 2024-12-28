import { z } from 'zod';

export const GlobalConfigSchema = z.object({
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
              type: z.enum(['private', 'public']).default('private').optional(),
              identity: z.string(),
              region: z.string(),
              repository_base: z.string(),
            }),
          ),
        }),
      }),
    }),
  }),
});

const LocalConfigJobSchema = z.object({
  on: z.object({
    push: z.object({
      branches: z.array(z.string()),
    }),
  }),
  loader: z.string(),
  docker_build: z.object({
    environment: z.object({
      type: z.literal('aws'),
      aws: z.object({
        identity: z.string(),
        registry: z.string(),
      }),
    }),
    tagging: z.enum(['semver_datetime', 'always_latest']),
    platforms: z.array(z.string()).default(['linux/amd64']),
  }),
});

export const LocalConfigSchema = z.object({
  metadata: z.object({
    name: z.string(),
  }),
  jobs: z.record(z.string(), LocalConfigJobSchema),
});

export const JobConfigParameterSchema = z.object({
  path: z.string(),
  committed_at: z.number(),
  event: z.object({
    type: z.literal('push'),
    branches: z.array(z.string()),
  }),
  job: z.object({
    loader: z.literal('docker_build'),
    config: z.object({
      environment: z.object({
        type: z.literal('aws'),
        aws: z.object({
          identity: z.object({
            iam_role: z.string(),
            region: z.string(),
          }),
          registry: z.object({
            type: z.enum(['private', 'public']).default('private'),
          }),
        }),
      }),
      context: z.string(),
      tags: z.string(),
      platforms: z.string().default('linux/amd64'),
    }),
  }),
  keys: z.array(z.tuple([z.string(), z.string()])),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type LocalConfig = z.infer<typeof LocalConfigSchema>;
export type JobConfigParameter = z.infer<typeof JobConfigParameterSchema>;
