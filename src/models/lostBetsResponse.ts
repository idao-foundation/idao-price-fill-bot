import { z } from 'zod';


export const LostBetsResponseSchema = z.array(
    z.object({
        id: z.number(),
        bid_end_timestamp: z.number(),
    })
);

export function validateLostBetsResponse(input: any) {
    try {
        const parsedBody = LostBetsResponseSchema.parse(input);
        return { parsedBody };
    } catch (error: any) {
        console.error('Validation error:', error);
        return { error };
    }
}

export type LostBetsResponse = z.input<typeof LostBetsResponseSchema>;