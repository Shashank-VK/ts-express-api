import { Prisma, PrismaClient } from '@prisma/client';
import { ConflictError } from '../lib/errors';
import type { User, ShortUrl } from '../types/models';
import type {
  ClickMetadata,
  ClickStats,
  CreateShortUrlInput,
  CreateUserInput,
  UpdateShortUrlInput,
  UrlListFilter,
  UrlRepository,
  UserRepository,
} from './interfaces';

const mapUser = (user: User): User => user;
const mapShortUrl = (shortUrl: ShortUrl): ShortUrl => shortUrl;

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class PrismaUserRepository implements UserRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async findByEmail(email: string): Promise<User | null> {
    const user = await this.client.user.findUnique({ where: { email } });
    return user ? mapUser(user) : null;
  }

  public async findById(id: string): Promise<User | null> {
    const user = await this.client.user.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  }

  public async create(input: CreateUserInput): Promise<User> {
    try {
      const user = await this.client.user.create({ data: input });
      return mapUser(user);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError('An account with that email already exists');
      }
      throw error;
    }
  }
}

export class PrismaUrlRepository implements UrlRepository {
  public constructor(private readonly client: PrismaClient) {}

  public async listByUser(
    userId: string,
    filter: UrlListFilter,
    skip: number,
    take: number,
  ): Promise<ShortUrl[]> {
    const where: Prisma.ShortUrlWhereInput = { userId };

    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search, mode: 'insensitive' } },
        { targetUrl: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    const urls = await this.client.shortUrl.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return urls.map(mapShortUrl);
  }

  public async countByUser(userId: string, filter: UrlListFilter): Promise<number> {
    const where: Prisma.ShortUrlWhereInput = { userId };

    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search, mode: 'insensitive' } },
        { targetUrl: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    return this.client.shortUrl.count({ where });
  }

  public async findByIdForUser(id: string, userId: string): Promise<ShortUrl | null> {
    const url = await this.client.shortUrl.findFirst({ where: { id, userId } });
    return url ? mapShortUrl(url) : null;
  }

  public async findByCode(code: string): Promise<ShortUrl | null> {
    const url = await this.client.shortUrl.findUnique({ where: { code } });
    return url ? mapShortUrl(url) : null;
  }

  public async create(input: CreateShortUrlInput): Promise<ShortUrl> {
    try {
      const url = await this.client.shortUrl.create({ data: input });
      return mapShortUrl(url);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError('That short code is already in use');
      }
      throw error;
    }
  }

  public async update(
    id: string,
    userId: string,
    input: UpdateShortUrlInput,
  ): Promise<ShortUrl | null> {
    const existing = await this.findByIdForUser(id, userId);
    if (!existing) {
      return null;
    }

    const url = await this.client.shortUrl.update({ where: { id }, data: input });
    return mapShortUrl(url);
  }

  public async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.client.shortUrl.deleteMany({ where: { id, userId } });
    return result.count === 1;
  }

  public async recordClick(shortUrlId: string, metadata: ClickMetadata): Promise<void> {
    await this.client.click.create({
      data: {
        shortUrlId,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        referer: metadata.referer,
      },
    });
  }

  public async getClickStats(shortUrlId: string): Promise<ClickStats> {
    const clicks = await this.client.click.findMany({
      where: { shortUrlId },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const byDay = new Map<string, number>();

    for (const click of clicks) {
      const date = click.createdAt.toISOString().slice(0, 10);
      byDay.set(date, (byDay.get(date) ?? 0) + 1);
    }

    return {
      totalClicks: clicks.length,
      lastClickedAt: clicks.at(-1)?.createdAt ?? null,
      clicksByDay: Array.from(byDay, ([date, count]) => ({ date, clicks: count })),
    };
  }
}
