import type { User, ShortUrl } from '../types/models';

export type CreateUserInput = {
  email: string;
  passwordHash: string;
};

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}

export type UrlListFilter = {
  search?: string;
  isActive?: boolean;
};

export type CreateShortUrlInput = {
  userId: string;
  code: string;
  targetUrl: string;
};

export type UpdateShortUrlInput = {
  targetUrl?: string;
  isActive?: boolean;
};

export type ClickMetadata = {
  ipAddress: string | null;
  userAgent: string | null;
  referer: string | null;
};

export type ClickStats = {
  totalClicks: number;
  lastClickedAt: Date | null;
  clicksByDay: Array<{ date: string; clicks: number }>;
};

export interface UrlRepository {
  listByUser(userId: string, filter: UrlListFilter, skip: number, take: number): Promise<ShortUrl[]>;
  countByUser(userId: string, filter: UrlListFilter): Promise<number>;
  findByIdForUser(id: string, userId: string): Promise<ShortUrl | null>;
  findByCode(code: string): Promise<ShortUrl | null>;
  create(input: CreateShortUrlInput): Promise<ShortUrl>;
  update(id: string, userId: string, input: UpdateShortUrlInput): Promise<ShortUrl | null>;
  delete(id: string, userId: string): Promise<boolean>;
  recordClick(shortUrlId: string, metadata: ClickMetadata): Promise<void>;
  getClickStats(shortUrlId: string): Promise<ClickStats>;
}
