import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { createApp } from '../app';
import type {
  ClickMetadata,
  ClickStats,
  CreateShortUrlInput,
  CreateUserInput,
  UpdateShortUrlInput,
  UrlListFilter,
  UrlRepository,
  UserRepository,
} from '../repositories/interfaces';
import type { ShortUrl, User } from '../types/models';

/* ------------------------------------------------------------------ */
/* In-memory fakes (no database needed for the HTTP test suite)        */
/* ------------------------------------------------------------------ */

class InMemoryUserRepository implements UserRepository {
  public readonly users = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const user: User = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }
}

type Click = { at: Date };

class InMemoryUrlRepository implements UrlRepository {
  public readonly urls = new Map<string, ShortUrl>();
  public readonly clicks = new Map<string, Click[]>();

  async listByUser(userId: string, filter: UrlListFilter, skip: number, take: number): Promise<ShortUrl[]> {
    return this.filtered(userId, filter).slice(skip, skip + take);
  }

  async countByUser(userId: string, filter: UrlListFilter): Promise<number> {
    return this.filtered(userId, filter).length;
  }

  async findByIdForUser(id: string, userId: string): Promise<ShortUrl | null> {
    const url = this.urls.get(id);
    return url && url.userId === userId ? url : null;
  }

  async findByCode(code: string): Promise<ShortUrl | null> {
    for (const url of this.urls.values()) {
      if (url.code === code) return url;
    }
    return null;
  }

  async create(input: CreateShortUrlInput): Promise<ShortUrl> {
    const now = new Date();
    const url: ShortUrl = {
      id: randomUUID(),
      userId: input.userId,
      code: input.code,
      targetUrl: input.targetUrl,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.urls.set(url.id, url);
    return url;
  }

  async update(id: string, userId: string, input: UpdateShortUrlInput): Promise<ShortUrl | null> {
    const url = await this.findByIdForUser(id, userId);
    if (!url) return null;
    if (input.targetUrl !== undefined) url.targetUrl = input.targetUrl;
    if (input.isActive !== undefined) url.isActive = input.isActive;
    url.updatedAt = new Date();
    return url;
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const url = await this.findByIdForUser(id, userId);
    if (!url) return false;
    this.urls.delete(id);
    return true;
  }

  async recordClick(shortUrlId: string, _metadata: ClickMetadata): Promise<void> {
    const list = this.clicks.get(shortUrlId) ?? [];
    list.push({ at: new Date() });
    this.clicks.set(shortUrlId, list);
  }

  async getClickStats(shortUrlId: string): Promise<ClickStats> {
    const list = this.clicks.get(shortUrlId) ?? [];
    const byDay = new Map<string, number>();
    for (const click of list) {
      const day = click.at.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return {
      totalClicks: list.length,
      lastClickedAt: list.length > 0 ? list[list.length - 1].at : null,
      clicksByDay: [...byDay.entries()].map(([date, clicks]) => ({ date, clicks })),
    };
  }

  private filtered(userId: string, filter: UrlListFilter): ShortUrl[] {
    return [...this.urls.values()]
      .filter((u) => u.userId === userId)
      .filter((u) => (filter.search ? u.targetUrl.includes(filter.search) || u.code.includes(filter.search) : true))
      .filter((u) => (filter.isActive === undefined ? true : u.isActive === filter.isActive))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const TEST_SECRET = 'test-jwt-secret';

function buildTestApp() {
  const users = new InMemoryUserRepository();
  const urls = new InMemoryUrlRepository();
  const app = createApp({
    userRepository: users,
    urlRepository: urls,
    jwtSecret: TEST_SECRET,
    jwtExpiresIn: '1h',
  });
  return { app, users, urls };
}

async function registerAndLogin(app: ReturnType<typeof createApp>, email = 'qa@example.com', password = 'password123') {
  const res = await request(app).post('/api/auth/register').send({ email, password });
  expect(res.status).toBe(201);
  return res.body as { user: { id: string; email: string }; token: string };
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('health', () => {
  it('returns ok', async () => {
    const { app } = buildTestApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('auth flows', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  it('registers a new user and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'new@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@example.com');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(10);
  });

  it('rejects duplicate registration with 409', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/register').send({ email: 'dup@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid email with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects a short password with 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send({ email: 'login@example.com', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects login with wrong password and unknown email', async () => {
    await request(app).post('/api/auth/register').send({ email: 'real@example.com', password: 'password123' });
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'real@example.com', password: 'wrongpass1' });
    expect(wrongPw.status).toBe(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'password123' });
    expect(unknown.status).toBe(401);
  });
});

describe('auth guards', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = buildTestApp().app;
  });

  it('rejects listing urls without a token', async () => {
    const res = await request(app).get('/api/urls');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(app).get('/api/urls').set(authHeader('not.a.real.token'));
    expect(res.status).toBe(401);
  });

  it('rejects creating a url without a token', async () => {
    const res = await request(app).post('/api/urls').send({ targetUrl: 'https://example.com' });
    expect(res.status).toBe(401);
  });
});

describe('url crud', () => {
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeEach(async () => {
    app = buildTestApp().app;
    ({ token } = await registerAndLogin(app));
  });

  it('creates a short url with a generated code', async () => {
    const res = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/page' });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toMatch(/^[a-zA-Z0-9_-]{8}$/);
    expect(res.body.data.targetUrl).toBe('https://example.com/page');
    expect(res.body.data.shortUrl).toContain('/r/');
  });

  it('creates a short url with a custom alias', async () => {
    const res = await request(app)
      .post('/api/urls')
      .set(authHeader(token))
      .send({ targetUrl: 'https://example.com/a', customAlias: 'myalias1' });
    expect(res.status).toBe(201);
    expect(res.body.data.code).toBe('myalias1');
  });

  it('rejects an invalid target url with 400', async () => {
    const res = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate custom alias with 409', async () => {
    await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/1', customAlias: 'dupe1234' });
    const res = await request(app)
      .post('/api/urls')
      .set(authHeader(token))
      .send({ targetUrl: 'https://example.com/2', customAlias: 'dupe1234' });
    expect(res.status).toBe(409);
  });

  it('lists urls with pagination metadata', async () => {
    await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/1' });
    await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/2' });
    const res = await request(app).get('/api/urls').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination.total).toBe(2);
    expect(res.body.pagination.page).toBe(1);
  });

  it('paginates the list', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: `https://example.com/${i}` });
    }
    const res = await request(app).get('/api/urls?page=2&limit=2').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.totalPages).toBe(2);
  });

  it('fetches a single url by id', async () => {
    const created = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/x' });
    const res = await request(app).get(`/api/urls/${created.body.data.id}`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.body.data.id);
  });

  it('rejects a non-uuid id with 400', async () => {
    const res = await request(app).get('/api/urls/not-a-uuid').set(authHeader(token));
    expect(res.status).toBe(400);
  });

  it('updates the target url', async () => {
    const created = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/old' });
    const res = await request(app)
      .patch(`/api/urls/${created.body.data.id}`)
      .set(authHeader(token))
      .send({ targetUrl: 'https://example.com/new' });
    expect(res.status).toBe(200);
    expect(res.body.data.targetUrl).toBe('https://example.com/new');
  });

  it('rejects an empty update body with 400', async () => {
    const created = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/old' });
    const res = await request(app).patch(`/api/urls/${created.body.data.id}`).set(authHeader(token)).send({});
    expect(res.status).toBe(400);
  });

  it('deletes a url and then returns 404', async () => {
    const created = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/del' });
    const del = await request(app).delete(`/api/urls/${created.body.data.id}`).set(authHeader(token));
    expect(del.status).toBe(204);
    const get = await request(app).get(`/api/urls/${created.body.data.id}`).set(authHeader(token));
    expect(get.status).toBe(404);
  });

  it('isolates urls between users', async () => {
    const created = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/mine' });
    const other = await registerAndLogin(app, 'other@example.com');
    const res = await request(app).get(`/api/urls/${created.body.data.id}`).set(authHeader(other.token));
    expect(res.status).toBe(404);
  });
});

describe('redirect and analytics', () => {
  let app: ReturnType<typeof createApp>;
  let token: string;

  beforeEach(async () => {
    app = buildTestApp().app;
    ({ token } = await registerAndLogin(app));
  });

  it('redirects a live code with 302 and records the click', async () => {
    const created = await request(app)
      .post('/api/urls')
      .set(authHeader(token))
      .send({ targetUrl: 'https://example.com/landing', customAlias: 'clickme01' });
    const res = await request(app).get('/r/clickme01').redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://example.com/landing');

    const stats = await request(app).get(`/api/urls/${created.body.data.id}/analytics`).set(authHeader(token));
    expect(stats.status).toBe(200);
    expect(stats.body.data.totalClicks).toBe(1);
    expect(stats.body.data.clicksByDay).toHaveLength(1);
  });

  it('returns 404 for an unknown code', async () => {
    const res = await request(app).get('/r/nosuchcode').redirects(0);
    expect(res.status).toBe(404);
  });

  it('returns zeroed analytics for a fresh url', async () => {
    const created = await request(app).post('/api/urls').set(authHeader(token)).send({ targetUrl: 'https://example.com/fresh' });
    const res = await request(app).get(`/api/urls/${created.body.data.id}/analytics`).set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.data.totalClicks).toBe(0);
  });
});
