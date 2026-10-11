import type { RequestHandler } from 'express';
import type { AuthService } from '../services/auth-service';

export const createAuthController = (service: AuthService) => ({
  register: (async (req, res) => {
    const result = await service.register(req.body.email, req.body.password);
    res.status(201).json(result);
  }) satisfies RequestHandler,

  login: (async (req, res) => {
    const result = await service.login(req.body.email, req.body.password);
    res.status(200).json(result);
  }) satisfies RequestHandler,
});
