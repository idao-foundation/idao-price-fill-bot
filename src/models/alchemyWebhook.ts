import { z } from 'zod';

export const AlchemyLogSchema = z.object({
  data: z.string(),
  topics: z.array(z.string()),
  index: z.number(),
  account: z.object({
    address: z.string(),
  }),
  transaction: z.object({
    hash: z.string(),
    nonce: z.number(),
    index: z.number(),
    from: z.object({
      address: z.string(),
    }),
    to: z.object({
      address: z.string(),
    }),
    value: z.string(),
    gasPrice: z.string(),
    maxFeePerGas: z.string(),
    maxPriorityFeePerGas: z.string(),
    gas: z.number(),
    status: z.number(),
    gasUsed: z.number(),
    cumulativeGasUsed: z.number(),
    effectiveGasPrice: z.string(),
    createdContract: z.string().nullable(),
  }),
});

export type AlchemyLog = z.infer<typeof AlchemyLogSchema>;

export const AlchemyWebhookEventSchema = z.object({
  webhookId: z.string(),
  id: z.string(),
  createdAt: z.string(),
  type: z.string(),
  event: z.object({
    data: z.object({
      block: z.object({
        hash: z.string(),
        number: z.number(),
        timestamp: z.number(),
        logs: z.array(AlchemyLogSchema),
      }),
    }),
    sequenceNumber: z.string(),
    network: z.string(),
  }),
});

export type AlchemyWebhookEvent = z.infer<typeof AlchemyWebhookEventSchema>;

export function validateAlchemyWebhookEvent(event: any) {
  try {
      const parsedBody = AlchemyWebhookEventSchema.parse(event);
      return { parsedBody };
  } catch (error: any) {
      console.error('Validation error:', error);
      return { error };
  }
}