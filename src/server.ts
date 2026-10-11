import { createApp } from './app';
import { loadConfig } from './config/env';
import { prisma } from './lib/prisma';
import { PrismaUrlRepository, PrismaUserRepository } from './repositories/prisma-repositories';

const config = loadConfig();
const app = createApp({
  userRepository: new PrismaUserRepository(prisma),
  urlRepository: new PrismaUrlRepository(prisma),
  jwtSecret: config.JWT_SECRET,
  jwtExpiresIn: config.JWT_EXPIRES_IN,
  corsOrigin: config.CORS_ORIGIN,
});

const server = app.listen(config.PORT, () => {
  console.info(`URL shortener API listening on port ${config.PORT}`);
});

const shutdown = (signal: string): void => {
  console.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
