import {
  findUserById,
  KycStatus,
  listUsersByKycStatus,
  reviewKyc as reviewKycRecord,
  submitKycDocument,
  UserRecord,
} from '../repositories/user.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { RequestContext } from '../types';
import { logAction } from './audit.service';
import { notifyKycRejected } from './notification.service';

export async function submitKyc(
  params: { userId: string; documentPath: string; documentMimeType: string },
  context: RequestContext = {}
): Promise<UserRecord> {
  const user = await submitKycDocument(params.userId, {
    documentPath: params.documentPath,
    documentMimeType: params.documentMimeType,
  });

  await logAction({
    userId: params.userId,
    action: 'kyc.submitted',
    resourceType: 'user',
    resourceId: params.userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return user;
}

export async function listPendingKyc(params: { page?: number; pageSize?: number; status?: KycStatus }) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const { users, total } = await listUsersByKycStatus({
    status: params.status ?? 'pending',
    limit: pageSize,
    offset,
  });

  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      kycStatus: user.kycStatus,
      kycSubmittedAt: user.kycSubmittedAt,
    })),
    total,
    page,
    pageSize,
  };
}

export async function reviewKyc(
  params: { userId: string; status: 'verified' | 'rejected'; rejectionReason?: string },
  context: RequestContext = {}
): Promise<UserRecord> {
  const user = await findUserById(params.userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  if (user.kycStatus !== 'pending') {
    throw new ConflictError('This KYC submission has already been reviewed');
  }

  const updated = await reviewKycRecord(params.userId, {
    status: params.status,
    rejectionReason: params.rejectionReason,
  });

  await logAction({
    userId: params.userId,
    action: params.status === 'verified' ? 'kyc.approved' : 'kyc.rejected',
    resourceType: 'user',
    resourceId: params.userId,
    metadata: params.rejectionReason ? { rejectionReason: params.rejectionReason } : undefined,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  if (params.status === 'rejected' && params.rejectionReason) {
    await notifyKycRejected({ email: user.email, rejectionReason: params.rejectionReason });
  }

  return updated;
}

export async function getKycDocumentPath(params: { userId: string; requesterId: string; requesterRole: string }) {
  if (params.requesterRole !== 'admin' && params.requesterId !== params.userId) {
    throw new ForbiddenError('You do not have permission to view this document');
  }

  const user = await findUserById(params.userId);
  if (!user || !user.kycDocumentPath) {
    throw new NotFoundError('No KYC document found for this user');
  }

  return { path: user.kycDocumentPath, mimeType: user.kycDocumentMimeType ?? 'application/octet-stream' };
}
