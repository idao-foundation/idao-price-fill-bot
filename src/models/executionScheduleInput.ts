import { z } from 'zod';

export const ExecutionScheduleInputSchema = z.object({
    betId: z.number(),
    network: z.string(),
});

export type ExecutionScheduleInput = z.infer<typeof ExecutionScheduleInputSchema>;