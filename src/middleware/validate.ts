import type { RequestHandler } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../lib/errors';

type ValidationSchemas = {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

export const validate = (schemas: ValidationSchemas): RequestHandler => (req, _res, next) => {
  try {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as typeof req.params;
    }
    if (schemas.query) {
      const parsed = schemas.query.parse(req.query);
      // Express 5 exposes req.query as a getter-only property; redefine it on
      // the instance so downstream handlers see the coerced values.
      Object.defineProperty(req, 'query', { value: parsed, writable: true, configurable: true });
    }
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      next(new BadRequestError('Request validation failed', error.flatten()));
      return;
    }
    next(error);
  }
};
