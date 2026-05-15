import { z } from 'zod';

const idPattern = /^[a-zA-Z0-9_-]+$/;

export const tenantEventParamsSchema = z.object({
  tenantId: z.string().min(1).max(64).regex(idPattern),
  eventId: z.string().min(1).max(64).regex(idPattern),
});
