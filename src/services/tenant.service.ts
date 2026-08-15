import { findActivePropertiesForTenant } from '../repositories/lease.repository';
import { listPaymentsForTenant, PaymentRecord } from '../repositories/payment.repository';
import { findPropertyById } from '../repositories/property.repository';
import { findUserById } from '../repositories/user.repository';
import { listRemindersForTenant, ReminderNotification } from '../repositories/reminder.repository';
import { getLeaseBalance, LeaseBalance } from './lease.service';
import { computeTenantScore, TenantScore } from './score.service';

export interface TenantLeaseOverview {
  leaseId: string;
  propertyId: string;
  address: string;
  numberOfApartments: number;
  balance: LeaseBalance;
  landlord: { name: string; email: string; phone: string } | null;
}

export async function getMyOverview(tenantId: string): Promise<TenantLeaseOverview[]> {
  const leases = await findActivePropertiesForTenant(tenantId);

  return Promise.all(
    leases.map(async (lease) => {
      const property = await findPropertyById(lease.propertyId);
      const landlordUser = property ? await findUserById(property.ownerId) : null;

      return {
        leaseId: lease.id,
        propertyId: lease.propertyId,
        address: lease.address,
        numberOfApartments: lease.numberOfApartments,
        balance: await getLeaseBalance(lease.id),
        landlord: landlordUser
          ? { name: landlordUser.name, email: landlordUser.email, phone: landlordUser.phone }
          : null,
      };
    })
  );
}

export interface TenantPaymentHistory {
  payments: PaymentRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export async function getMyPaymentHistory(
  tenantId: string,
  params: { page?: number; pageSize?: number }
): Promise<TenantPaymentHistory> {
  const pageSize = params.pageSize ?? 20;
  const page = params.page ?? 1;

  const { payments, total } = await listPaymentsForTenant(tenantId, {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  return { payments, total, page, pageSize };
}

export async function getMyNotifications(tenantId: string): Promise<ReminderNotification[]> {
  return listRemindersForTenant(tenantId);
}

export async function getMyScore(tenantId: string): Promise<TenantScore> {
  return computeTenantScore(tenantId);
}
