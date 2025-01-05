import { z } from 'zod';

const BaseEventSchema = z.object({
  eventName: z.string(),
  ref: z.string(),
});

const PullRequestEventSchema = BaseEventSchema.extend({
  eventName: z.literal('pull_request'),
  ref: z.string().regex(/^refs\/pull\/\d+\/merge$/),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  payload: z.object({
    pull_request: z.object({
      number: z.number(),
      base: z.object({
        ref: z.string(),
      }),
      head: z.object({
        ref: z.string(),
      }),
    }),
  }),
});

const PullRequestTargetEventSchema = BaseEventSchema.extend({
  eventName: z.literal('pull_request_target'),
  ref: z.string().regex(/^refs\/heads\//),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  payload: z.object({
    pull_request: z.object({
      number: z.number(),
      base: z.object({
        ref: z.string(),
      }),
      head: z.object({
        ref: z.string(),
      }),
    }),
  }),
});

const PushEventScema = BaseEventSchema.extend({
  eventName: z.literal('push'),
  ref: z.string().regex(/^refs\/heads\//),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});

export const EventSchema = z.union([
  PullRequestEventSchema,
  PullRequestTargetEventSchema,
  PushEventScema,
  BaseEventSchema.extend({
    eventName: z.enum(['workflow_dispatch', 'schedule', 'repository_dispatch']),
  }),
]);

export type Event = z.infer<typeof EventSchema>;
