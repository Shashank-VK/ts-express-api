import type { RequestHandler } from 'express';
import type { UrlService } from '../services/url-service';

const userIdFromRequest = (req: Express.Request): string => {
  if (!req.user) {
    throw new Error('Authentication middleware did not set a user');
  }
  return req.user.id;
};

const toUrlResponse = (req: Express.Request, url: Awaited<ReturnType<UrlService['get']>>) => ({
  id: url.id,
  code: url.code,
  shortUrl: `${req.protocol}://${req.get('host') ?? 'localhost'}/r/${url.code}`,
  targetUrl: url.targetUrl,
  isActive: url.isActive,
  createdAt: url.createdAt,
  updatedAt: url.updatedAt,
});

export const createUrlController = (service: UrlService) => ({
  list: (async (req, res) => {
    const result = await service.list(userIdFromRequest(req), req.query.page, req.query.limit, {
      search: req.query.search,
      isActive: req.query.isActive,
    });
    res.status(200).json({
      ...result,
      data: result.data.map((url) => toUrlResponse(req, url)),
    });
  }) satisfies RequestHandler,

  create: (async (req, res) => {
    const url = await service.create(userIdFromRequest(req), req.body.targetUrl, req.body.customAlias);
    res.status(201).json({ data: toUrlResponse(req, url) });
  }) satisfies RequestHandler,

  get: (async (req, res) => {
    const url = await service.get(req.params.id, userIdFromRequest(req));
    res.status(200).json({ data: toUrlResponse(req, url) });
  }) satisfies RequestHandler,

  update: (async (req, res) => {
    const url = await service.update(req.params.id, userIdFromRequest(req), {
      targetUrl: req.body.targetUrl,
      isActive: req.body.isActive,
    });
    res.status(200).json({ data: toUrlResponse(req, url) });
  }) satisfies RequestHandler,

  remove: (async (req, res) => {
    await service.delete(req.params.id, userIdFromRequest(req));
    res.status(204).send();
  }) satisfies RequestHandler,

  analytics: (async (req, res) => {
    const stats = await service.analytics(req.params.id, userIdFromRequest(req));
    res.status(200).json({ data: stats });
  }) satisfies RequestHandler,

  redirect: (async (req, res) => {
    const targetUrl = await service.resolve(req.params.code, {
      ipAddress: req.ip || null,
      userAgent: req.get('user-agent') ?? null,
      referer: req.get('referer') ?? null,
    });
    res.redirect(302, targetUrl);
  }) satisfies RequestHandler,
});
