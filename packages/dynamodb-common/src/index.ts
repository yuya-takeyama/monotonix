import { z } from 'zod';

export const StateItemSchema = z.object({
  appPath: z.string(),
  jobKey: z.string(),
  jobStatus: z.enum(['running', 'success']),
  commitTs: z.number(),
  commitHash: z.string(),
});

export type StateItem = z.infer<typeof StateItemSchema>;
