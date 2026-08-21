import { GlobalConfigSchema, JobSchema } from '@monotonix/schema';
import { z } from 'zod';

export const DockerBuildGlobalConfigSchema = GlobalConfigSchema.extend({
  job_types: z.object({
    docker_build: z.object({
      registries: z.object({
        aws: z
          .object({
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
                base_url: z.string().min(1),
              }),
            ),
          })
          .optional(),
        gcp: z
          .object({
            iams: z.record(
              z.string(),
              z.object({
                workload_identity_provider: z.string(),
                service_account: z.string(),
              }),
            ),
            repositories: z.record(
              z.string(),
              z.object({
                base_url: z.string().min(1),
              }),
            ),
          })
          .optional(),
      }),
    }),
  }),
});

export type DockerBuildGlobalConfig = z.infer<
  typeof DockerBuildGlobalConfigSchema
>;

const InputRegistrySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('aws'),
    aws: z.object({
      iam: z.string(),
      repository: z.string(),
    }),
  }),
  z.object({
    type: z.literal('gcp'),
    gcp: z.object({
      iam: z.string(),
      repository: z.string(),
    }),
  }),
]);

const InputJobSchema = JobSchema.extend({
  configs: JobSchema.shape.configs.extend({
    docker_build: z.object({
      registry: InputRegistrySchema,
      tagging: z.enum(['always_latest', 'semver_datetime', 'pull_request']),
      platforms: z.array(z.string()),
      context: z.string().optional(),
      dockerfile: z.string().optional(),
    }),
  }),
});

export type InputJob = z.infer<typeof InputJobSchema>;

export const InputJobsSchema = z.array(InputJobSchema);
export type InputJobs = z.infer<typeof InputJobsSchema>;

const OutputRegistrySchema = z.discriminatedUnion('type', [
  z.object({
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
  z.object({
    type: z.literal('gcp'),
    gcp: z.object({
      iam: z.object({
        workload_identity_provider: z.string(),
        service_account: z.string(),
      }),
      repository: z.object({
        host: z.string(),
      }),
    }),
  }),
]);

const OutputJobSchema = InputJobSchema.extend({
  params: InputJobSchema.shape.params.extend({
    docker_build: z.object({
      registry: OutputRegistrySchema,
      context: z.string(),
      dockerfile: z.string().optional(),
      tags: z.string(),
      platforms: z.string(),
    }),
  }),
});

export type OutputJob = z.infer<typeof OutputJobSchema>;

export const OutputJobsSchema = z.array(OutputJobSchema);
export type OutputJobs = z.infer<typeof OutputJobsSchema>;
