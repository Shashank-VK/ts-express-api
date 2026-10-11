import jwt, { type SignOptions } from 'jsonwebtoken';
import { UnauthorizedError } from './errors';

export type AuthTokenPayload = {
  sub: string;
  email: string;
};

export const signToken = (payload: AuthTokenPayload, secret: string, expiresIn: string): string =>
  jwt.sign(payload, secret, { expiresIn: expiresIn as SignOptions['expiresIn'] });

export const verifyToken = (token: string, secret: string): AuthTokenPayload => {
  try {
    const decoded = jwt.verify(token, secret);

    if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || typeof decoded.email !== 'string') {
      throw new UnauthorizedError('Invalid authentication token');
    }

    return { sub: decoded.sub, email: decoded.email };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new UnauthorizedError('Invalid or expired authentication token');
  }
};
