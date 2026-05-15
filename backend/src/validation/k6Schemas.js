import { z } from 'zod';

export const k6RunBodySchema = z.object({
  scenario: z.string().min(1).max(64),
  vus: z.number().int().positive().max(10_000).optional(),
  iterations: z.number().int().positive().max(1_000_000).optional(),
  duration: z
    .string()
    .regex(/^\d+[smh]$/, 'duration must look like 30s / 5m / 1h')
    .optional(),
});
