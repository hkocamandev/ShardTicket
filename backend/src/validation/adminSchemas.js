import { z } from 'zod';

export const modeBodySchema = z.object({
  mode: z.enum(['tx', 'nontx']),
});

export const seedBodySchema = z.object({
  mode: z.enum(['hot', 'multi']).default('hot'),
});

export const flagBodySchema = z.object({
  flag: z.enum(['USE_REDIS_CACHE', 'USE_REDIS_LOCK']),
  value: z.boolean(),
});
