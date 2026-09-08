import fs from 'fs';
import {
  createProperty,
  findPropertiesByOwnerId,
  findPropertyById,
  listPropertiesByVerificationStatus,
  PropertyRecord,
  PropertyVerificationStatus,
  reviewVerification as reviewVerificationRecord,
  submitVerificationDocument,
  updateProperty as updatePropertyRecord,
  UpdatePropertyParams,
} from '../repositories/property.repository';
import {
  findActiveLease,
  findActivePropertiesForTenant,
  findAllActiveLeasesForLandlord,
  LeaseWithProperty,
} from '../repositories/lease.repository';
import { findUserById } from '../repositories/user.repository';
import {
  addPropertyPhoto as addPropertyPhotoRecord,
  deletePropertyPhoto as deletePropertyPhotoRecord,
  findCoverPhoto,
  findPropertyPhotoById,
  listPropertyPhotos as listPropertyPhotosRecords,
  PropertyPhotoRecord,
} from '../repositories/property-photo.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { RequestContext } from '../types';
import { logAction } from './audit.service';
import { createInAppNotification, notifyPropertyVerificationRejected } from './notification.service';

async function assertCanViewProperty(params: { propertyId: string; userId: string; role: string }): Promise<PropertyRecord> {
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

export async function addProperty(
  params: {
    ownerId: string;
    address: string;
    numberOfApartments: number;
    propertyType?: string;
    surfaceArea?: number;
    bedroomCount?: number;
    bathroomCount?: number;
    monthlyRent?: number;
  },
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

export async function listMyProperties(
  params: { userId: string; role: string }
): Promise<(PropertyRecord & { occupiedUnits: number })[] | LeaseWithProperty[]> {
  if (params.role === 'tenant') {
    return findActivePropertiesForTenant(params.userId);
  }

  const [properties, activeLeases] = await Promise.all([
    findPropertiesByOwnerId(params.userId),
    findAllActiveLeasesForLandlord(params.userId),
  ]);

  const occupiedUnitsByProperty = new Map<string, number>();
  for (const lease of activeLeases) {
    occupiedUnitsByProperty.set(lease.propertyId, (occupiedUnitsByProperty.get(lease.propertyId) ?? 0) + 1);
  }

  return properties.map((property) => ({
    ...property,
    occupiedUnits: occupiedUnitsByProperty.get(property.id) ?? 0,
  }));
}

export async function getProperty(params: { propertyId: string; userId: string; role: string }): Promise<PropertyRecord> {
  return assertCanViewProperty(params);
}

export async function addPropertyPhoto(
  params: { propertyId: string; ownerId: string; path: string; mimeType: string },
  context: RequestContext = {}
): Promise<PropertyPhotoRecord> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (property.ownerId !== params.ownerId) {
    throw new ForbiddenError('You do not have permission to manage this property');
  }

  const photo = await addPropertyPhotoRecord({
    propertyId: params.propertyId,
    path: params.path,
    mimeType: params.mimeType,
  });

  await logAction({
    userId: params.ownerId,
    action: 'property.photo_added',
    resourceType: 'property',
    resourceId: params.propertyId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return photo;
}

export async function listPropertyPhotos(params: { propertyId: string; userId: string; role: string }): Promise<PropertyPhotoRecord[]> {
  await assertCanViewProperty(params);
  return listPropertyPhotosRecords(params.propertyId);
}

export async function getPropertyPhotoFile(params: {
  propertyId: string;
  photoId: string;
  userId: string;
  role: string;
}): Promise<{ path: string; mimeType: string }> {
  await assertCanViewProperty(params);
  const photo = await findPropertyPhotoById(params.photoId);
  if (!photo || photo.propertyId !== params.propertyId) {
    throw new NotFoundError('Photo not found');
  }
  return { path: photo.path, mimeType: photo.mimeType };
}

export async function getCoverPhotoFile(params: {
  propertyId: string;
  userId: string;
  role: string;
}): Promise<{ path: string; mimeType: string } | null> {
  await assertCanViewProperty(params);
  const photo = await findCoverPhoto(params.propertyId);
  return photo ? { path: photo.path, mimeType: photo.mimeType } : null;
}

export async function deletePropertyPhoto(params: { propertyId: string; photoId: string; ownerId: string }): Promise<void> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (property.ownerId !== params.ownerId) {
    throw new ForbiddenError('You do not have permission to manage this property');
  }

  const photo = await findPropertyPhotoById(params.photoId);
  if (!photo || photo.propertyId !== params.propertyId) {
    throw new NotFoundError('Photo not found');
  }

  await deletePropertyPhotoRecord(params.photoId);

  if (!photo.path.startsWith('http://') && !photo.path.startsWith('https://')) {
    fs.unlink(photo.path, () => undefined);
  }
}

export async function updateProperty(
  params: { propertyId: string; ownerId: string } & UpdatePropertyParams,
  context: RequestContext = {}
): Promise<PropertyRecord> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (property.ownerId !== params.ownerId) {
    throw new ForbiddenError('You do not have permission to manage this property');
  }

  const updated = await updatePropertyRecord(params.propertyId, {
    address: params.address,
    numberOfApartments: params.numberOfApartments,
    propertyType: params.propertyType,
    surfaceArea: params.surfaceArea,
    bedroomCount: params.bedroomCount,
    bathroomCount: params.bathroomCount,
    monthlyRent: params.monthlyRent,
  });

  await logAction({
    userId: params.ownerId,
    action: 'property.updated',
    resourceType: 'property',
    resourceId: params.propertyId,
    metadata: { address: updated.address },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return updated;
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

  await createInAppNotification({
    userId: property.ownerId,
    type: params.status === 'verified' ? 'property_verified' : 'property_rejected',
    title: params.status === 'verified' ? 'Propriété vérifiée' : 'Vérification refusée',
    body:
      params.status === 'verified'
        ? `${property.address} a été vérifiée avec succès.`
        : `La vérification de ${property.address} a été refusée.${params.rejectionReason ? ` Motif : ${params.rejectionReason}` : ''}`,
    propertyId: property.id,
  });

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
