import { z } from 'zod';

// Metadata schema - completely flexible
const MetadataSchema = z.record(z.string(), z.any());

export const GlobalConfigSchema = z.object({
  job_types: z.record(z.string(), z.object({}).passthrough()),
  // New: optional metadata schema definitions
  metadata_schemas: z
    .object({
      app: z.record(z.string(), z.any()).optional(),
      job: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});

export type GlobalConfig = z.infer<typeof GlobalConfigSchema>;

const AppSchema = z.object({
  depends_on: z.array(z.string()).optional().default([]),
  metadata: MetadataSchema.default({}), // Default to empty object
});

const ContextSchema = z.object({
  dedupe_key: z.string(),
  github_ref: z.string(),
  app_path: z.string(),
  root_dir: z.string(),
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

const JobConfigSchema = z.object({}).passthrough();

export const JobConfigsSchema = z
  .object({})
  .catchall(JobConfigSchema.nullable());

const LocalConfigJobSchema = z.object({
  on: JobEventSchema,
  configs: JobConfigsSchema,
  metadata: MetadataSchema.default({}), // Default to empty object
});

export type LocalConfigJob = z.infer<typeof LocalConfigJobSchema>;

export const LocalConfigSchema = z.object({
  app: AppSchema.default(() => ({ depends_on: [], metadata: {} })),
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
  metadata: MetadataSchema.default({}), // Default to empty object
});

export type Job = z.infer<typeof JobSchema>;

export const JobsSchema = z.array(JobSchema);
export type Jobs = z.infer<typeof JobsSchema>;
