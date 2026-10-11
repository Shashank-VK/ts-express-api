import { randomBytes, randomUUID } from 'node:crypto';
import { ConflictError, NotFoundError } from '../lib/errors';
import type {
  ClickMetadata,
  CreateShortUrlInput,
  UpdateShortUrlInput,
  UrlListFilter,
  UrlRepository,
} from '../repositories/interfaces';
import type { ShortUrl } from '../types/models';

const ALIAS_PATTERN = /^[a-zA-Z0-9_-]{4,32}$/;
const GENERATED_CODE_LENGTH = 8;

export type PaginatedUrls = {
  data: ShortUrl[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class UrlService {
  public constructor(private readonly urls: UrlRepository) {}

  public async list(
    userId: string,
    page: number,
    limit: number,
    filter: UrlListFilter,
  ): Promise<PaginatedUrls> {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.urls.listByUser(userId, filter, skip, limit),
      this.urls.countByUser(userId, filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  public async create(userId: string, targetUrl: string, customAlias?: string): Promise<ShortUrl> {
    const code = customAlias ?? this.generateCode();

    if (customAlias && !ALIAS_PATTERN.test(customAlias)) {
      throw new ConflictError('customAlias must be 4-32 letters, numbers, underscores, or hyphens');
    }

    if (await this.urls.findByCode(code)) {
      throw new ConflictError('That short code is already in use');
    }

    const input: CreateShortUrlInput = { userId, code, targetUrl };
    return this.createWithRetry(input, customAlias === undefined);
  }

  public async get(id: string, userId: string): Promise<ShortUrl> {
    const url = await this.urls.findByIdForUser(id, userId);
    if (!url) {
      throw new NotFoundError('Short URL not found');
    }
    return url;
  }

  public async update(id: string, userId: string, input: UpdateShortUrlInput): Promise<ShortUrl> {
    const url = await this.urls.update(id, userId, input);
    if (!url) {
      throw new NotFoundError('Short URL not found');
    }
    return url;
  }

  public async delete(id: string, userId: string): Promise<void> {
    const deleted = await this.urls.delete(id, userId);
    if (!deleted) {
      throw new NotFoundError('Short URL not found');
    }
  }

  public async analytics(id: string, userId: string) {
    await this.get(id, userId);
    return this.urls.getClickStats(id);
  }

  public async resolve(code: string, metadata: ClickMetadata): Promise<string> {
    const url = await this.urls.findByCode(code);
    if (!url || !url.isActive) {
      throw new NotFoundError('Short URL not found');
    }

    await this.urls.recordClick(url.id, metadata);
    return url.targetUrl;
  }

  private async createWithRetry(input: CreateShortUrlInput, retryGeneratedCode: boolean): Promise<ShortUrl> {
    try {
      return await this.urls.create(input);
    } catch (error) {
      if (!(error instanceof ConflictError) || !retryGeneratedCode) {
        throw error;
      }

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const retryInput = { ...input, code: this.generateCode() };
        if (await this.urls.findByCode(retryInput.code)) {
          continue;
        }
        try {
          return await this.urls.create(retryInput);
        } catch (retryError) {
          if (!(retryError instanceof ConflictError)) {
            throw retryError;
          }
        }
      }
      throw new ConflictError('Could not allocate a unique short code');
    }
  }

  private generateCode(): string {
    return randomBytes(GENERATED_CODE_LENGTH).toString('base64url').slice(0, GENERATED_CODE_LENGTH);
  }
}

export const createId = (): string => randomUUID();
