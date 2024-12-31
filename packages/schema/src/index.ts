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

const LocalConfigJobConfigSchema = z.object({}).passthrough();

const LocalConfigJobSchema = z.object({
  on: LocalConfigJobEventSchema,
  type: z.string(),
  config: LocalConfigJobConfigSchema,
});

export const LocalConfigSchema = z.object({
  app: z.object({
    name: z.string(),
  }),
  jobs: z.record(z.string(), LocalConfigJobSchema),
});

const AppContextSchema = z.object({
  path: z.string(),
  last_commit: z.object({
    hash: z.string(),
    timestamp: z.number(),
  }),
});

const JobTargetKeys = z.array(z.tuple([z.string(), z.string()]));

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

export const JobConfigSchema = z.object({
  app: AppSchema,
  app_context: AppContextSchema,
  on: LocalConfigJobEventSchema,
  type: z.string(),
  config: LocalConfigJobConfigSchema,
  keys: JobTargetKeys,
});

export type JobConfig = z.infer<typeof JobConfigSchema>;

export const JobParamSchema = JobConfigSchema.extend({
  param: z.record(z.string(), z.any()),
});

export type JobParam = z.infer<typeof JobParamSchema>;
