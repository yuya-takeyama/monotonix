import { z } from 'zod';

export const GlobalConfigSchema = z.object({
  job_types: z.record(z.string(), z.object({}).passthrough()),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

const AppSchema = z.object({
  name: z.string(),
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

const JobEventSchema = z.intersection(PushEventScema, PullRequestEventSchema);

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

const ContextSchema = z.object({
  workflow_id: z.string(),
  app_path: z.string(),
  last_commit: z.object({
    hash: z.string(),
    timestamp: z.number(),
  }),
  label: z.string(),
});

const JobTargetKeys = z.array(z.tuple([z.string(), z.string()]));

export type LocalConfig = z.infer<typeof LocalConfigSchema>;

export const JobSchema = z.object({
  app: AppSchema,
  context: ContextSchema,
  on: JobEventSchema,
  configs: JobConfigsSchema,
  params: z.object({}).catchall(z.object({}).catchall(z.any())),
  keys: JobTargetKeys,
});

export type Job = z.infer<typeof JobSchema>;

export const JobsSchema = z.array(JobSchema);
export type Jobs = z.infer<typeof JobsSchema>;
