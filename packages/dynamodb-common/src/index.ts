import { z } from 'zod';

export const StateItemSchema = z.object({
  pk: z.string(),
  sk: z.string(),
  appPath: z.string(),
  jobKey: z.string(),
  jobStatus: z.enum(['running', 'success']),
  commitTs: z.number(),
  commitHash: z.string(),
  ttl: z.number(),
});

export type StateItem = z.infer<typeof StateItemSchema>;
