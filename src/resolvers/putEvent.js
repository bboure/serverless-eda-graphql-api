import { util } from '@aws-appsync/utils';

export function request(ctx) {
  const { event } = ctx.stash;

  if (!event) {
    console.error('No event found in stash');
    util.error('InternalError');
  }

  return {
    operation: 'PutEvents',
    events: [
      {
        source: 'order.api',
        ...event,
      },
    ],
  };
}

export function response(ctx) {
  return ctx.prev.result;
}
