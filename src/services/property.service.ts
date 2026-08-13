import {
  createProperty,
  findPropertiesByOwnerId,
  findPropertyById,
  PropertyRecord,
} from '../repositories/property.repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export async function addProperty(params: {
  ownerId: string;
  address: string;
  numberOfApartments: number;
}): Promise<PropertyRecord> {
  return createProperty(params);
}

export async function listMyProperties(ownerId: string): Promise<PropertyRecord[]> {
  return findPropertiesByOwnerId(ownerId);
}

export async function getProperty(params: { propertyId: string; userId: string; role: string }): Promise<PropertyRecord> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }

  if (params.role !== 'admin' && property.ownerId !== params.userId) {
    throw new ForbiddenError('You do not have permission to view this property');
  }

  return property;
}
