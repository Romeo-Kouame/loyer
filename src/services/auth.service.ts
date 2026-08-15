import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { JwtPayload, RequestContext } from '../types';
import { ConflictError, NotFoundError, UnauthorizedError } from '../utils/errors';
import {
  createUser,
  findUserByEmail,
  findUserById,
  updatePassword,
  updateProfile as updateProfileRecord,
  updateProfilePicture as updateProfilePictureRecord,
  UpdateProfileParams,
  UserRecord,
} from '../repositories/user.repository';
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
    kycSubmittedAt: user.kycSubmittedAt,
    kycReviewedAt: user.kycReviewedAt,
    kycRejectionReason: user.kycRejectionReason,
    emailRemindersEnabled: user.emailRemindersEnabled,
    hasProfilePicture: Boolean(user.profilePicturePath),
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    placeOfBirth: user.placeOfBirth,
    nationality: user.nationality,
    idDocumentType: user.idDocumentType,
    idDocumentNumber: user.idDocumentNumber,
    activitySector: user.activitySector,
    profession: user.profession,
    secondPhone: user.secondPhone,
    currentAddress: user.currentAddress,
    emergencyContactName: user.emergencyContactName,
    emergencyContactPhone: user.emergencyContactPhone,
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

export async function changePassword(
  params: { userId: string; currentPassword: string; newPassword: string },
  context: RequestContext = {}
): Promise<void> {
  const user = await findUserById(params.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  const currentMatches = await bcrypt.compare(params.currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const newHash = await bcrypt.hash(params.newPassword, PASSWORD_HASH_ROUNDS);
  await updatePassword(user.id, newHash);

  await logAction({
    userId: user.id,
    action: 'user.password_changed',
    resourceType: 'user',
    resourceId: user.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
}

export async function updateProfile(
  params: { userId: string } & UpdateProfileParams,
  context: RequestContext = {}
) {
  const { userId, ...profileParams } = params;
  const updated = await updateProfileRecord(userId, profileParams);

  await logAction({
    userId,
    action: 'user.profile_updated',
    resourceType: 'user',
    resourceId: userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return toPublicUser(updated);
}

export async function updateProfilePicture(
  params: { userId: string; path: string; mimeType: string },
  context: RequestContext = {}
) {
  const updated = await updateProfilePictureRecord(params.userId, { path: params.path, mimeType: params.mimeType });

  await logAction({
    userId: params.userId,
    action: 'user.profile_picture_updated',
    resourceType: 'user',
    resourceId: params.userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return toPublicUser(updated);
}

export async function getProfilePicturePath(userId: string): Promise<{ path: string; mimeType: string }> {
  const user = await findUserById(userId);
  if (!user || !user.profilePicturePath || !user.profilePictureMimeType) {
    throw new NotFoundError('No profile picture set');
  }
  return { path: user.profilePicturePath, mimeType: user.profilePictureMimeType };
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
