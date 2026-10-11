import { ConflictError, UnauthorizedError } from '../lib/errors';
import { comparePassword, hashPassword } from '../lib/password';
import { signToken } from '../lib/jwt';
import type { UserRepository } from '../repositories/interfaces';

export type AuthServiceOptions = {
  jwtSecret: string;
  jwtExpiresIn: string;
};

export type AuthResult = {
  user: { id: string; email: string };
  token: string;
};

export class AuthService {
  public constructor(
    private readonly users: UserRepository,
    private readonly options: AuthServiceOptions,
  ) {}

  public async register(email: string, password: string): Promise<AuthResult> {
    const normalisedEmail = email.trim().toLowerCase();
    const existing = await this.users.findByEmail(normalisedEmail);
    if (existing) {
      throw new ConflictError('An account with that email already exists');
    }

    const passwordHash = await hashPassword(password);
    const user = await this.users.create({ email: normalisedEmail, passwordHash });
    return this.withToken(user.id, user.email);
  }

  public async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const valid = user ? await comparePassword(password, user.passwordHash) : false;

    if (!user || !valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return this.withToken(user.id, user.email);
  }

  private withToken(id: string, email: string): AuthResult {
    return {
      user: { id, email },
      token: signToken({ sub: id, email }, this.options.jwtSecret, this.options.jwtExpiresIn),
    };
  }
}
