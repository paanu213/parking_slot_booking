import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';

type Target = 'body' | 'query' | 'params';

export const validate =
  <T>(schema: ZodSchema<T>, target: Target = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) return next(result.error);
    // overwrite with parsed (strips unknown keys, applies defaults)
    (req as Record<Target, unknown>)[target] = result.data;
    next();
  };
