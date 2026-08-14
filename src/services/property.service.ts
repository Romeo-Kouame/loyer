import {
  createProperty,
  findPropertiesByOwnerId,
  findPropertyById,
  listPropertiesByVerificationStatus,
  PropertyRecord,
  PropertyVerificationStatus,
  reviewVerification as reviewVerificationRecord,
  submitVerificationDocument,
} from '../repositories/property.repository';
import { findActiveLease, findActivePropertiesForTenant, LeaseWithProperty } from '../repositories/lease.repository';
import { findUserById } from '../repositories/user.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { RequestContext } from '../types';
import { logAction } from './audit.service';
import { notifyPropertyVerificationRejected } from './notification.service';

export async function addProperty(
  params: { ownerId: string; address: string; numberOfApartments: number },
  context: RequestContext = {}
): Promise<PropertyRecord> {
  const property = await createProperty(params);

  await logAction({
    userId: params.ownerId,
    action: 'property.created',
    resourceType: 'property',
    resourceId: property.id,
    metadata: { address: property.address },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return property;
}

export async function listMyProperties(params: { userId: string; role: string }): Promise<PropertyRecord[] | LeaseWithProperty[]> {
  if (params.role === 'tenant') {
    return findActivePropertiesForTenant(params.userId);
  }
  return findPropertiesByOwnerId(params.userId);
}

export async function getProperty(params: { propertyId: string; userId: string; role: string }): Promise<PropertyRecord> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }

  if (params.role === 'admin' || property.ownerId === params.userId) {
    return property;
  }

  if (params.role === 'tenant') {
    const lease = await findActiveLease(params.propertyId, params.userId);
    if (lease) {
      return property;
    }
  }

  throw new ForbiddenError('You do not have permission to view this property');
}

export async function submitVerification(
  params: { propertyId: string; ownerId: string; documentPath: string; documentMimeType: string },
  context: RequestContext = {}
): Promise<PropertyRecord> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (property.ownerId !== params.ownerId) {
    throw new ForbiddenError('You do not have permission to manage this property');
  }

  const updated = await submitVerificationDocument(params.propertyId, {
    documentPath: params.documentPath,
    documentMimeType: params.documentMimeType,
  });

  await logAction({
    userId: params.ownerId,
    action: 'property.verification_submitted',
    resourceType: 'property',
    resourceId: params.propertyId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return updated;
}

export async function listPendingVerifications(params: {
  page?: number;
  pageSize?: number;
  status?: PropertyVerificationStatus;
}) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const { properties, total } = await listPropertiesByVerificationStatus({
    status: params.status ?? 'pending_review',
    limit: pageSize,
    offset,
  });

  return { properties, total, page, pageSize };
}

export async function reviewVerification(
  params: { propertyId: string; status: 'verified' | 'rejected'; rejectionReason?: string },
  context: RequestContext = {}
): Promise<PropertyRecord> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (property.verificationStatus !== 'pending_review') {
    throw new ConflictError('This property verification has already been reviewed');
  }

  const updated = await reviewVerificationRecord(params.propertyId, {
    status: params.status,
    rejectionReason: params.rejectionReason,
  });

  await logAction({
    userId: property.ownerId,
    action: params.status === 'verified' ? 'property.verification_approved' : 'property.verification_rejected',
    resourceType: 'property',
    resourceId: params.propertyId,
    metadata: params.rejectionReason ? { rejectionReason: params.rejectionReason } : undefined,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  if (params.status === 'rejected' && params.rejectionReason) {
    const landlord = await findUserById(property.ownerId);
    if (landlord) {
      await notifyPropertyVerificationRejected({
        landlordEmail: landlord.email,
        propertyAddress: property.address,
        rejectionReason: params.rejectionReason,
      });
    }
  }

  return updated;
}

export async function getVerificationDocumentPath(params: {
  propertyId: string;
  requesterId: string;
  requesterRole: string;
}) {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (params.requesterRole !== 'admin' && property.ownerId !== params.requesterId) {
    throw new ForbiddenError('You do not have permission to view this document');
  }
  if (!property.verificationDocumentPath) {
    throw new NotFoundError('No verification document found for this property');
  }

  return {
    path: property.verificationDocumentPath,
    mimeType: property.verificationDocumentMimeType ?? 'application/octet-stream',
  };
}
