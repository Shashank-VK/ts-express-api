import { z } from 'zod';

export const createUrlSchema = z
  .object({
    targetUrl: z.string().trim().url().max(2048),
    customAlias: z.string().trim().optional(),
  })
  .strict();

export const updateUrlSchema = z
  .object({
    targetUrl: z.string().trim().url().max(2048).optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const idParamsSchema = z.object({ id: z.string().uuid() });
export const codeParamsSchema = z.object({ code: z.string().regex(/^[a-zA-Z0-9_-]{4,32}$/) });

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
