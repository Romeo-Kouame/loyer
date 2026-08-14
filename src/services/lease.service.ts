import { findUserByEmail } from '../repositories/user.repository';
import { findPropertyById } from '../repositories/property.repository';
import {
  createLease,
  endLease as endLeaseRecord,
  findActiveLease,
  findLeaseById,
  LeaseRecord,
} from '../repositories/lease.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';

async function assertOwnsProperty(propertyId: string, landlordId: string) {
  const property = await findPropertyById(propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (property.ownerId !== landlordId) {
    throw new ForbiddenError('You do not have permission to manage this property');
  }
  return property;
}

export async function assignTenant(params: {
  landlordId: string;
  propertyId: string;
  tenantEmail: string;
}): Promise<LeaseRecord> {
  await assertOwnsProperty(params.propertyId, params.landlordId);

  const tenant = await findUserByEmail(params.tenantEmail);
  if (!tenant || tenant.role !== 'tenant') {
    throw new NotFoundError('No tenant account found with this email');
  }

  const existing = await findActiveLease(params.propertyId, tenant.id);
  if (existing) {
    throw new ConflictError('This tenant already has an active lease on this property');
  }

  return createLease({ propertyId: params.propertyId, tenantId: tenant.id });
}

export async function endLease(params: {
  landlordId: string;
  propertyId: string;
  leaseId: string;
}): Promise<LeaseRecord> {
  await assertOwnsProperty(params.propertyId, params.landlordId);

  const lease = await findLeaseById(params.leaseId);
  if (!lease || lease.propertyId !== params.propertyId) {
    throw new NotFoundError('Lease not found');
  }
  if (lease.status !== 'active') {
    throw new ConflictError('This lease has already ended');
  }

  return endLeaseRecord(params.leaseId);
}
