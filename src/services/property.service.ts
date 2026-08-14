import {
  createProperty,
  findPropertiesByOwnerId,
  findPropertyById,
  PropertyRecord,
} from '../repositories/property.repository';
import { findActiveLease, findActivePropertiesForTenant, LeaseWithProperty } from '../repositories/lease.repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { RequestContext } from '../types';
import { logAction } from './audit.service';

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
