import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { JwtPayload, RequestContext } from '../types';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { createUser, findUserByEmail, findUserById, UserRecord } from '../repositories/user.repository';
import { logAction } from './audit.service';

const PASSWORD_HASH_ROUNDS = 10;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function toPublicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
    kycStatus: user.kycStatus,
  };
}

function signTokens(user: UserRecord): AuthTokens {
  const payload: JwtPayload = { userId: user.id, email: user.email, role: user.role };

  const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiry } as jwt.SignOptions);
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  } as jwt.SignOptions);

  return { accessToken, refreshToken };
}

export async function register(
  params: {
    email: string;
    phone: string;
    name: string;
    password: string;
    role: 'landlord' | 'tenant';
  },
  context: RequestContext = {}
) {
  const existing = await findUserByEmail(params.email);
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(params.password, PASSWORD_HASH_ROUNDS);
  const user = await createUser({
    email: params.email,
    phone: params.phone,
    name: params.name,
    passwordHash,
    role: params.role,
  });

  await logAction({
    userId: user.id,
    action: 'user.registered',
    resourceType: 'user',
    resourceId: user.id,
    metadata: { role: user.role },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { user: toPublicUser(user), tokens: signTokens(user) };
}

export async function login(email: string, password: string, context: RequestContext = {}) {
  const user = await findUserByEmail(email);
  if (!user) {
    await logAction({
      action: 'user.login_failed',
      metadata: { email },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    await logAction({
      userId: user.id,
      action: 'user.login_failed',
      metadata: { email },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new UnauthorizedError('Invalid email or password');
  }

  await logAction({
    userId: user.id,
    action: 'user.login',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { user: toPublicUser(user), tokens: signTokens(user) };
}

export async function getCurrentUser(userId: string) {
  const user = await findUserById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return toPublicUser(user);
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await findUserById(payload.userId);
  if (!user) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  return signTokens(user);
}
