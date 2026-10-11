import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();
  req.requestId = randomUUID();
  res.setHeader('x-request-id', req.requestId);

  res.on('finish', () => {
    const entry = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    };
    console.info(JSON.stringify(entry));
  });

  next();
};
