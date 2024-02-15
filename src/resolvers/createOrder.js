import { util } from '@aws-appsync/utils';
import { put } from '@aws-appsync/utils/dynamodb';

export const request = (ctx) => {
  const order = {
    id: util.autoId(),
    status: 'PENDING',
    products: ctx.arguments.input.products,
    createdAt: util.time.nowISO8601(),
    updatedAt: util.time.nowISO8601(),
  };

  return put({
    key: {
      id: order.id,
    },
    item: order,
  });
};

export const response = (ctx) => {
  ctx.stash.event = { detailType: 'order.created', detail: ctx.result };

  return ctx.result;
};
