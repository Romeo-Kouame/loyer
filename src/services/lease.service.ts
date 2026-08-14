import { config } from '../config/environment';
import { findUserByEmail } from '../repositories/user.repository';
import { findPropertyById } from '../repositories/property.repository';
import {
  createLease,
  endLease as endLeaseRecord,
  findActiveLease,
  findLeaseById,
  LeaseRecord,
  sumConfirmedPaymentsForLease,
} from '../repositories/lease.repository';
import { ConflictError, ForbiddenError, NotFoundError } from '../utils/errors';
import { RequestContext } from '../types';
import { logAction } from './audit.service';

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

export async function assignTenant(
  params: {
    landlordId: string;
    propertyId: string;
    tenantEmail: string;
    rentAmount: number;
    moveInDate: string;
    installmentsAllowed: boolean;
  },
  context: RequestContext = {}
): Promise<LeaseRecord> {
  await assertOwnsProperty(params.propertyId, params.landlordId);

  const tenant = await findUserByEmail(params.tenantEmail);
  if (!tenant || tenant.role !== 'tenant') {
    throw new NotFoundError('No tenant account found with this email');
  }

  const existing = await findActiveLease(params.propertyId, tenant.id);
  if (existing) {
    throw new ConflictError('This tenant already has an active lease on this property');
  }

  const lease = await createLease({
    propertyId: params.propertyId,
    tenantId: tenant.id,
    rentAmount: params.rentAmount,
    moveInDate: params.moveInDate,
    installmentsAllowed: params.installmentsAllowed,
  });

  await logAction({
    userId: params.landlordId,
    action: 'lease.created',
    resourceType: 'lease',
    resourceId: lease.id,
    metadata: { propertyId: params.propertyId, tenantId: tenant.id, rentAmount: params.rentAmount },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return lease;
}

export async function endLease(
  params: { landlordId: string; propertyId: string; leaseId: string },
  context: RequestContext = {}
): Promise<LeaseRecord> {
  await assertOwnsProperty(params.propertyId, params.landlordId);

  const lease = await findLeaseById(params.leaseId);
  if (!lease || lease.propertyId !== params.propertyId) {
    throw new NotFoundError('Lease not found');
  }
  if (lease.status !== 'active') {
    throw new ConflictError('This lease has already ended');
  }

  const ended = await endLeaseRecord(params.leaseId);

  await logAction({
    userId: params.landlordId,
    action: 'lease.ended',
    resourceType: 'lease',
    resourceId: lease.id,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return ended;
}

/** Adds `months` to `date`, clamping the day to the last day of the target month. */
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const firstOfTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);
  return new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth(), clampedDay));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export interface LeaseBalance {
  rentAmount: number;
  moveInDate: string;
  installmentsAllowed: boolean;
  periodsElapsed: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  isLate: boolean;
  currentDueDate: string;
  nextDueDate: string;
}

export async function getLeaseBalance(leaseId: string, asOf: Date = new Date()): Promise<LeaseBalance> {
  const lease = await findLeaseById(leaseId);
  if (!lease) {
    throw new NotFoundError('Lease not found');
  }

  const moveInDate = new Date(`${lease.moveInDate}T00:00:00.000Z`);
  const today = asOf;
  const rentAmount = Number(lease.rentAmount);

  let periodsElapsed = 0;
  while (addMonthsClamped(moveInDate, periodsElapsed + 1) <= today) {
    periodsElapsed++;
  }

  const currentDueDate = addMonthsClamped(moveInDate, periodsElapsed);
  const nextDueDate = addMonthsClamped(moveInDate, periodsElapsed + 1);

  const totalDue = (periodsElapsed + 1) * rentAmount;
  const totalPaid = await sumConfirmedPaymentsForLease(leaseId);
  const balance = totalDue - totalPaid;

  const graceDeadline = addDays(currentDueDate, config.rent.gracePeriodDays);
  const isLate = balance > 0 && today > graceDeadline;

  return {
    rentAmount,
    moveInDate: lease.moveInDate,
    installmentsAllowed: lease.installmentsAllowed,
    periodsElapsed: periodsElapsed + 1,
    totalDue,
    totalPaid,
    balance,
    isLate,
    currentDueDate: currentDueDate.toISOString().slice(0, 10),
    nextDueDate: nextDueDate.toISOString().slice(0, 10),
  };
}

export async function getLeaseBalanceForUser(params: {
  leaseId: string;
  userId: string;
  role: string;
}): Promise<LeaseBalance> {
  const lease = await findLeaseById(params.leaseId);
  if (!lease) {
    throw new NotFoundError('Lease not found');
  }

  if (params.role === 'tenant' && lease.tenantId !== params.userId) {
    throw new ForbiddenError('You do not have permission to view this lease');
  }

  if (params.role === 'landlord') {
    await assertOwnsProperty(lease.propertyId, params.userId);
  }

  return getLeaseBalance(params.leaseId);
}
