export type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

export type ShortUrl = {
  id: string;
  userId: string;
  code: string;
  targetUrl: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};
