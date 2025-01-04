import { z } from 'zod';

export const GlobalConfigSchema = z.object({
  job_types: z.record(z.string(), z.object({}).passthrough()),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

const AppSchema = z.object({
  name: z.string(),
});

const ContextSchema = z.object({
  dedupe_key: z.string(),
  github_ref: z.string(),
  app_path: z.string(),
  last_commit: z.object({
    hash: z.string(),
    timestamp: z.number(),
  }),
  job_key: z.string(),
  label: z.string(),
});

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

const PullRequestTargetEventSchema = z.object({
  pull_request_target: z
    .object({
      branches: z.array(z.string()).optional(),
    })
    .optional()
    .nullable(),
});

const JobEventSchema = z.intersection(
  PushEventScema,
  z.intersection(PullRequestEventSchema, PullRequestTargetEventSchema),
);

const JobConfigsSchema = z.object({}).catchall(z.object({}).catchall(z.any()));

const LocalConfigJobSchema = z.object({
  on: JobEventSchema,
  configs: JobConfigsSchema,
});

export type LocalConfigJob = z.infer<typeof LocalConfigJobSchema>;

export const LocalConfigSchema = z.object({
  app: z.object({
    name: z.string(),
  }),
  jobs: z.record(z.string(), LocalConfigJobSchema),
});

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

const JobParamsSchema = z.object({}).catchall(z.object({}).catchall(z.any()));

export const JobSchema = z.object({
  app: AppSchema,
  context: ContextSchema,
  on: JobEventSchema,
  configs: JobConfigsSchema,
  params: JobParamsSchema,
});

export type Job = z.infer<typeof JobSchema>;

export const JobsSchema = z.array(JobSchema);
export type Jobs = z.infer<typeof JobsSchema>;
