import { z } from 'zod';
import { dataResponse } from './common';

export const healthSchema = z.object({
  status: z.literal('ok'),
});
export type Health = z.infer<typeof healthSchema>;

export const readinessSchema = z.object({
  status: z.literal('ok'),
  checks: z.object({
    database: z.literal('ok'),
    redis: z.literal('ok'),
  }),
});
export type Readiness = z.infer<typeof readinessSchema>;

export const healthResponseSchema = dataResponse(healthSchema);
export const readinessResponseSchema = dataResponse(readinessSchema);
