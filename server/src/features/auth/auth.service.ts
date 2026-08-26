// Usage:
// Holds auth business logic: hash passwords, verify credentials, translate
// database errors, and issue JWTs.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';
import {
  isPostgresError,
  POSTGRES_UNIQUE_VIOLATION
} from '../../shared/postgres-errors.js';
import { createUser, findUserByEmail, type PublicUser } from './auth.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const BCRYPT_COST = 12;

type AuthResult = {
  user: PublicUser;
  accessToken: string;
};

function signAccessToken(user: PublicUser): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn']
  };

  return jwt.sign(
    {
      sub: user.id,
      email: user.email
    },
    env.JWT_SECRET,
    options
  );
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const user = await createUser({
      email: input.email,
      passwordHash,
      displayName: input.displayName
    });

    return {
      user,
      accessToken: signAccessToken(user)
    };
  } catch (error) {
    if (isPostgresError(error) && error.code === POSTGRES_UNIQUE_VIOLATION) {
      throw new HttpError(409, 'Email is already registered', 'EMAIL_TAKEN');
    }

    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await findUserByEmail(input.email);

  if (!user || !user.isActive) {
    throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return {
    user,
    accessToken: signAccessToken(user)
  };
}
