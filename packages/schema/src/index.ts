import { z } from 'zod';

export const GlobalConfigSchema = z.object({
  job_types: z.record(z.string(), z.object({}).passthrough()),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

const PushEventScema = z.object({
  push: z
    .object({
      branches: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
});

const PullRequestEventSchema = z.object({
  pull_request: z
    .object({
      branches: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
});

const AppSchema = z.object({
  name: z.string(),
});

const LocalConfigJobEventSchema = z.intersection(
  PushEventScema,
  PullRequestEventSchema,
);

const LocalConfigJobConfigSchema = z
  .object({
    job_type: z.string(),
  })
  .passthrough();

export const LocalConfigSchema = z.object({
  app: z.object({
    name: z.string(),
  }),
  jobs: z.record(
    z.string(),
    z.object({
      on: LocalConfigJobEventSchema,
      config: LocalConfigJobConfigSchema,
    }),
  ),
});

const AppContextSchema = z.object({
  path: z.string(),
});

const JobTargetKeys = z.array(z.tuple([z.string(), z.string()]));

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

export const JobConfigSchema = z.object({
  app: AppSchema,
  app_context: AppContextSchema,
  on: LocalConfigJobEventSchema,
  config: LocalConfigJobConfigSchema,
  keys: JobTargetKeys,
});

export type JobConfig = z.infer<typeof JobConfigSchema>;

export const JobParam = z.object({
  app: AppSchema,
  app_context: AppContextSchema,
  config: LocalConfigJobConfigSchema,
  param: z.record(z.string(), z.any()),
  keys: JobTargetKeys,
});

export type JobParam = z.infer<typeof JobParam>;
