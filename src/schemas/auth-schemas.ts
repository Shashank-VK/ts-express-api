import { z } from 'zod';

const email = z.string().trim().email().max(320);
const password = z.string().min(8).max(128);

export const registerSchema = z.object({ email, password }).strict();
export const loginSchema = z.object({ email, password }).strict();
