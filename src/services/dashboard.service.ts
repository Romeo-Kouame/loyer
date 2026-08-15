import { findPropertiesByOwnerId } from '../repositories/property.repository';
import { countActiveLeasesForLandlord, findAllActiveLeasesForLandlord } from '../repositories/lease.repository';
import {
  countPendingPaymentsForLandlord,
  listRecentPaymentsForLandlord,
  monthlyRevenueForLandlord,
  RecentPaymentForLandlord,
  sumConfirmedPaymentsForLandlordThisMonth,
} from '../repositories/payment.repository';
import { getLeaseBalance } from './lease.service';

export interface LandlordDashboard {
  totalCollectedThisMonth: number;
  totalProperties: number;
  totalTenants: number;
  pendingPayments: number;
  outstandingBalance: number;
}

export async function getLandlordDashboard(landlordId: string): Promise<LandlordDashboard> {
  const [properties, totalTenants, totalCollectedThisMonth, pendingPayments, activeLeases] = await Promise.all([
    findPropertiesByOwnerId(landlordId),
    countActiveLeasesForLandlord(landlordId),
    sumConfirmedPaymentsForLandlordThisMonth(landlordId),
    countPendingPaymentsForLandlord(landlordId),
    findAllActiveLeasesForLandlord(landlordId),
  ]);

  const balances = await Promise.all(activeLeases.map((lease) => getLeaseBalance(lease.id)));
  const outstandingBalance = balances.reduce((sum, b) => sum + Math.max(0, b.balance), 0);

  return {
    totalCollectedThisMonth,
    totalProperties: properties.length,
    totalTenants,
    pendingPayments,
    outstandingBalance,
  };
}

export async function getRevenueHistory(landlordId: string): Promise<{ month: string; total: number }[]> {
  return monthlyRevenueForLandlord(landlordId, 6);
}

export async function getRecentPayments(landlordId: string): Promise<RecentPaymentForLandlord[]> {
  return listRecentPaymentsForLandlord(landlordId, 8);
}
