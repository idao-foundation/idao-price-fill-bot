import { z } from 'zod';

export const ExecutionScheduleInputSchema = z.object({
    betId: z.number(),
    network: z.string(),
    isLostBet: z.boolean().default(false),
});

export function validateExecutionScheduleInput(input: any) {
  try {
      const parsedBody = ExecutionScheduleInputSchema.parse(input);
      return { parsedBody };
  } catch (error: any) {
      console.error('Validation error:', error);
      return { error };
  }
}

export type ExecutionScheduleInput = z.input<typeof ExecutionScheduleInputSchema>;