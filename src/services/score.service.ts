import { findActivePropertiesForTenant, findLeaseById } from '../repositories/lease.repository';
import { countPaymentsByStatusForTenant } from '../repositories/payment.repository';
import { findPropertyById } from '../repositories/property.repository';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { getLeaseBalance } from './lease.service';

export type TenantGrade = 'excellent' | 'good' | 'fair' | 'at_risk';

export interface TenantScore {
  score: number;
  grade: TenantGrade;
  confirmedPayments: number;
  failedPayments: number;
  disputedPayments: number;
  activeLeasesCount: number;
  lateLeasesCount: number;
}

function gradeFor(score: number): TenantGrade {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'at_risk';
}

// Blends payment reliability (confirmed vs. failed/disputed settled payments)
// with current standing (active leases that are not late). A tenant with no
// payment history yet defaults to a neutral 100 rather than being penalized
// for having just joined.
export async function computeTenantScore(tenantId: string): Promise<TenantScore> {
  const counts = await countPaymentsByStatusForTenant(tenantId);
  const settled = counts.confirmed + counts.failed + counts.disputed;
  const reliabilityRate = settled > 0 ? counts.confirmed / settled : 1;

  const leases = await findActivePropertiesForTenant(tenantId);
  const balances = await Promise.all(leases.map((lease) => getLeaseBalance(lease.id)));
  const lateLeasesCount = balances.filter((balance) => balance.isLate).length;
  const standingRate = leases.length > 0 ? (leases.length - lateLeasesCount) / leases.length : 1;

  const score = Math.round((reliabilityRate * 0.6 + standingRate * 0.4) * 100);

  return {
    score,
    grade: gradeFor(score),
    confirmedPayments: counts.confirmed,
    failedPayments: counts.failed,
    disputedPayments: counts.disputed,
    activeLeasesCount: leases.length,
    lateLeasesCount,
  };
}

export async function getScoreForLandlord(params: {
  propertyId: string;
  leaseId: string;
  landlordId: string;
}): Promise<TenantScore> {
  const property = await findPropertyById(params.propertyId);
  if (!property) {
    throw new NotFoundError('Property not found');
  }
  if (property.ownerId !== params.landlordId) {
    throw new ForbiddenError('You do not have permission to view this lease');
  }

  const lease = await findLeaseById(params.leaseId);
  if (!lease || lease.propertyId !== params.propertyId) {
    throw new NotFoundError('Lease not found');
  }

  return computeTenantScore(lease.tenantId);
}
