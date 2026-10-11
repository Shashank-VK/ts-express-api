import { Router } from 'express';
import { createUrlController } from '../controllers/url-controller';
import { asyncHandler } from '../middleware/async-handler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  codeParamsSchema,
  createUrlSchema,
  idParamsSchema,
  listQuerySchema,
  updateUrlSchema,
} from '../schemas/url-schemas';
import type { UrlService } from '../services/url-service';

export const createUrlRouter = (service: UrlService, jwtSecret: string): Router => {
  const router = Router();
  const controller = createUrlController(service);

  router.use(requireAuth(jwtSecret));
  router.get('/', validate({ query: listQuerySchema }), asyncHandler(controller.list));
  router.post('/', validate({ body: createUrlSchema }), asyncHandler(controller.create));
  router.get('/:id', validate({ params: idParamsSchema }), asyncHandler(controller.get));
  router.patch('/:id', validate({ params: idParamsSchema, body: updateUrlSchema }), asyncHandler(controller.update));
  router.delete('/:id', validate({ params: idParamsSchema }), asyncHandler(controller.remove));
  router.get('/:id/analytics', validate({ params: idParamsSchema }), asyncHandler(controller.analytics));

  return router;
};

export const createRedirectRouter = (service: UrlService): Router => {
  const router = Router();
  const controller = createUrlController(service);
  router.get('/:code', validate({ params: codeParamsSchema }), asyncHandler(controller.redirect));
  return router;
};
