import { z } from 'zod';

export const modeBodySchema = z.object({
  mode: z.enum(['tx', 'nontx']),
});

export const seedBodySchema = z.object({
  mode: z.enum(['hot', 'multi']).default('hot'),
});
