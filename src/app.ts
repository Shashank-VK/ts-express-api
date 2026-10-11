import cors from 'cors';
import express, { type Express, type RequestHandler } from 'express';
import { createAuthRouter } from './routes/auth-routes';
import { createRedirectRouter, createUrlRouter } from './routes/url-routes';
import { AuthService } from './services/auth-service';
import { UrlService } from './services/url-service';
import type { UrlRepository, UserRepository } from './repositories/interfaces';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { NotFoundError } from './lib/errors';

export type AppDependencies = {
  userRepository: UserRepository;
  urlRepository: UrlRepository;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin?: string;
};

export const createApp = (dependencies: AppDependencies): Express => {
  const app = express();
  const authService = new AuthService(dependencies.userRepository, {
    jwtSecret: dependencies.jwtSecret,
    jwtExpiresIn: dependencies.jwtExpiresIn,
  });
  const urlService = new UrlService(dependencies.urlRepository);
  const configuredOrigins = (dependencies.corsOrigin ?? '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestLogger);
  app.use(
    cors({
      origin: configuredOrigins.includes('*') ? true : configuredOrigins,
    }),
  );
  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'url-shortener' });
  });
  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/urls', createUrlRouter(urlService, dependencies.jwtSecret));
  app.use('/r', createRedirectRouter(urlService));

  const notFound: RequestHandler = (_req, _res, next) => next(new NotFoundError('Route not found'));
  app.use(notFound);
  app.use(errorHandler);
  return app;
};
