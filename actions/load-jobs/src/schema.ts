import { z } from 'zod';

const BaseEventSchema = z.object({
  event_name: z.string(),
  ref: z.string(),
});

const PullRequestEventSchema = BaseEventSchema.extend({
  event_name: z.literal('pull_request'),
  ref: z.string().regex(/^refs\/pull\/\d+\/merge$/),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  head_ref: z.string(),
  base_ref: z.string(),
  event: z.object({
    number: z.number(),
    pull_request: z.object({
      number: z.number(),
    }),
  }),
});

const PullRequestTargetEventSchema = BaseEventSchema.extend({
  event_name: z.literal('pull_request_target'),
  ref: z.string().regex(/^refs\/heads\//),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  head_ref: z.string(),
  base_ref: z.string(),
  event: z.object({
    number: z.number(),
    pull_request: z.object({
      number: z.number(),
    }),
  }),
});

const PushEventScema = BaseEventSchema.extend({
  event_name: z.literal('push'),
  ref: z.string().regex(/^refs\/heads\//),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});

export const EventSchema = z.union([
  PullRequestEventSchema,
  PullRequestTargetEventSchema,
  PushEventScema,
]);
