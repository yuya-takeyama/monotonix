import { z } from 'zod';

export const GlobalConfigSchema = z.object({
  loaders: z.object({
    docker_build: z.object({
      aws: z.object({
        identities: z.record(
          z.object({
            iam_role: z.string(),
            region: z.string(),
          }),
        ),
        registries: z.record(
          z.object({
            identity: z.string(),
            region: z.string(),
            repository_base: z.string(),
          }),
        ),
      }),
    }),
  }),
});

export const LocalConfigSchema = z.object({
  jobs: z.array(
    z.object({
      on: z.object({
        push: z.object({
          branches: z.array(z.string()),
        }),
      }),
      loader: z.string(),
      docker_build: z.object({
        environment_type: z.string(),
        aws: z.object({
          identity: z.string(),
          registry: z.string(),
        }),
        tagging: z.enum(['semver_datetime', 'always_latest']),
        platforms: z.array(z.string()).default(['linux/amd64']),
      }),
    }),
  ),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type LocalConfig = z.infer<typeof LocalConfigSchema>;
