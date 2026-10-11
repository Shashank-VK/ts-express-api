import { Router } from 'express';
import { createAuthController } from '../controllers/auth-controller';
import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../schemas/auth-schemas';
import type { AuthService } from '../services/auth-service';

export const createAuthRouter = (service: AuthService): Router => {
  const router = Router();
  const controller = createAuthController(service);

  router.post('/register', validate({ body: registerSchema }), asyncHandler(controller.register));
  router.post('/login', validate({ body: loginSchema }), asyncHandler(controller.login));

  return router;
};
