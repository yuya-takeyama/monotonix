import { z } from 'zod';

export const GlobalConfigSchema = z.object({
  loaders: z.record(z.object({}).passthrough()),
});

const PushEventScema = z.object({
  push: z.object({
    branches: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const PullRequestEventSchema = z.object({
  pull_request: z.object({
    branches: z.array(z.string()).optional(),
  }),
});

export const LocalConfigSchema = z.object({
  app: z.object({
    name: z.string(),
  }),
  jobs: z.record(
    z.string(),
    z.object({
      on: z.intersection(PushEventScema, PullRequestEventSchema),
      config: z
        .object({
          loader: z.string(),
        })
        .passthrough(),
    }),
  ),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;
export type LocalConfig = z.infer<typeof LocalConfigSchema>;

export type Job = {
  app: LocalConfig['app'] & { path: string };
  on: LocalConfig['jobs'][string]['on'];
  config: LocalConfig['jobs'][string]['config'];
};
