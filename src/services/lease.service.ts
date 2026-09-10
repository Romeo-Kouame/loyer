import { config } from '../config/environment';
import { findUserByEmail, findUserByPhone } from '../repositories/user.repository';
import { findPropertyById } from '../repositories/property.repository';
import {
  createLease,
  endLease as endLeaseRecord,
  findActiveLease,
  findActiveLeaseByUnit,
  findActiveLeasesForProperty,
  findAllActiveLeasesForLandlordWithDetails,
  findLeaseById,
  LeaseRecord,
  LeaseWithTenant,
  sumConfirmedPaymentsForLease,
} from '../repositories/lease.repository';
import { listConfirmedPaymentDatesForLease } from '../repositories/payment.repository';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
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

// Côte d'Ivoire caps the security deposit and advance rent a landlord can
// demand up front at 2 months' rent each.
const MAX_DEPOSIT_MONTHS = 2;
const MAX_ADVANCE_RENT_MONTHS = 2;

export async function assignTenant(
  params: {
    landlordId: string;
    propertyId: string;
    tenantEmail?: string;
    tenantPhone?: string;
    unitLabel: string;
    rentAmount: number;
    moveInDate: string;
    installmentsAllowed: boolean;
    depositAmount?: number;
    advanceRentAmount?: number;
  },
  context: RequestContext = {}
): Promise<LeaseRecord> {
  await assertOwnsProperty(params.propertyId, params.landlordId);

  if (params.depositAmount !== undefined && params.depositAmount > params.rentAmount * MAX_DEPOSIT_MONTHS) {
    throw new ValidationError(`Security deposit cannot exceed ${MAX_DEPOSIT_MONTHS} months' rent`);
  }
  if (
    params.advanceRentAmount !== undefined &&
    params.advanceRentAmount > params.rentAmount * MAX_ADVANCE_RENT_MONTHS
  ) {
    throw new ValidationError(`Advance rent cannot exceed ${MAX_ADVANCE_RENT_MONTHS} months' rent`);
  }

  const tenant = params.tenantEmail
    ? await findUserByEmail(params.tenantEmail)
    : params.tenantPhone
      ? await findUserByPhone(params.tenantPhone)
      : null;
  if (!tenant || tenant.role !== 'tenant') {
    throw new NotFoundError('No tenant account found with this email or phone number');
  }

  const existing = await findActiveLease(params.propertyId, tenant.id);
  if (existing) {
    throw new ConflictError('This tenant already has an active lease on this property');
  }

  const unitTaken = await findActiveLeaseByUnit(params.propertyId, params.unitLabel);
  if (unitTaken) {
    throw new ConflictError('This unit already has an active tenant');
  }

  const lease = await createLease({
    propertyId: params.propertyId,
    tenantId: tenant.id,
    unitLabel: params.unitLabel,
    rentAmount: params.rentAmount,
    moveInDate: params.moveInDate,
    installmentsAllowed: params.installmentsAllowed,
    depositAmount: params.depositAmount,
    advanceRentAmount: params.advanceRentAmount,
  });

  await logAction({
    userId: params.landlordId,
    action: 'lease.created',
    resourceType: 'lease',
    resourceId: lease.id,
    metadata: { propertyId: params.propertyId, tenantId: tenant.id, unitLabel: params.unitLabel, rentAmount: params.rentAmount },
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

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
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
  daysOverdue: number;
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
  const daysOverdue = balance > 0 ? Math.max(0, daysBetween(currentDueDate, today)) : 0;

  return {
    rentAmount,
    moveInDate: lease.moveInDate,
    installmentsAllowed: lease.installmentsAllowed,
    periodsElapsed: periodsElapsed + 1,
    totalDue,
    totalPaid,
    balance,
    isLate,
    daysOverdue,
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

export interface ArrearsEntry {
  leaseId: string;
  tenantName: string;
  tenantEmail: string;
  unitLabel: string | null;
  rentAmount: number;
  balance: number;
  daysOverdue: number;
  isLate: boolean;
  currentDueDate: string;
}

export async function getPropertyArrears(params: {
  propertyId: string;
  landlordId: string;
}): Promise<ArrearsEntry[]> {
  await assertOwnsProperty(params.propertyId, params.landlordId);

  const leases = await findActiveLeasesForProperty(params.propertyId);

  const entries: ArrearsEntry[] = [];
  for (const lease of leases) {
    const balance = await getLeaseBalance(lease.id);
    if (balance.balance > 0) {
      entries.push({
        leaseId: lease.id,
        tenantName: lease.tenantName,
        tenantEmail: lease.tenantEmail,
        unitLabel: lease.unitLabel,
        rentAmount: Number(lease.rentAmount),
        balance: balance.balance,
        daysOverdue: balance.daysOverdue,
        isLate: balance.isLate,
        currentDueDate: balance.currentDueDate,
      });
    }
  }

  return entries.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export interface LandlordArrearsEntry extends ArrearsEntry {
  propertyAddress: string;
}

export async function getLandlordArrears(landlordId: string): Promise<LandlordArrearsEntry[]> {
  const leases = await findAllActiveLeasesForLandlordWithDetails(landlordId);

  const entries: LandlordArrearsEntry[] = [];
  for (const lease of leases) {
    const balance = await getLeaseBalance(lease.id);
    if (balance.balance > 0) {
      entries.push({
        leaseId: lease.id,
        tenantName: lease.tenantName,
        tenantEmail: lease.tenantEmail,
        unitLabel: lease.unitLabel,
        propertyAddress: lease.address,
        rentAmount: Number(lease.rentAmount),
        balance: balance.balance,
        daysOverdue: balance.daysOverdue,
        isLate: balance.isLate,
        currentDueDate: balance.currentDueDate,
      });
    }
  }

  return entries.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export type PaymentTrend = 'improving' | 'stable' | 'worsening' | 'insufficient_data';

// Flags a tenant whose payment cadence is drifting later month over month -
// e.g. paying every 30 days, then 33, then 38 - before that drift actually
// crosses into a missed/late payment. This looks at the gap between
// consecutive confirmed payments rather than due dates, so it needs no
// extra schema: three or more confirmed payments are enough to see a trend.
// A one-day tolerance absorbs weekend/processing jitter so it doesn't read
// as a trend in either direction.
export function computePaymentTrend(confirmedPaymentDates: Date[]): PaymentTrend {
  if (confirmedPaymentDates.length < 3) {
    return 'insufficient_data';
  }

  const sorted = [...confirmedPaymentDates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }

  const recentGaps = gaps.slice(-3);
  const TOLERANCE_DAYS = 1;
  let isIncreasing = true;
  let isDecreasing = true;
  for (let i = 1; i < recentGaps.length; i++) {
    if (recentGaps[i] <= recentGaps[i - 1] + TOLERANCE_DAYS) isIncreasing = false;
    if (recentGaps[i] >= recentGaps[i - 1] - TOLERANCE_DAYS) isDecreasing = false;
  }

  if (isIncreasing) return 'worsening';
  if (isDecreasing) return 'improving';
  return 'stable';
}

export interface LeaseWithTenantAndTrend extends LeaseWithTenant {
  paymentTrend: PaymentTrend;
}

export async function listActiveTenantsForProperty(params: {
  propertyId: string;
  landlordId: string;
}): Promise<LeaseWithTenantAndTrend[]> {
  await assertOwnsProperty(params.propertyId, params.landlordId);
  const leases = await findActiveLeasesForProperty(params.propertyId);

  return Promise.all(
    leases.map(async (lease) => ({
      ...lease,
      paymentTrend: computePaymentTrend(await listConfirmedPaymentDatesForLease(lease.id)),
    }))
  );
}
