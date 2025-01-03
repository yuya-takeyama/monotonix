import { Context } from '@actions/github/lib/context';

export function getCommittedAt(context: Context) {
  return new Date(context.payload.head_commit.timestamp).getTime() / 1000;
}
