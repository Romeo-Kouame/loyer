import { findAllActiveLeasesWithTenant } from '../repositories/lease.repository';
import { hasReminderBeenSent, recordReminderSent, ReminderType } from '../repositories/reminder.repository';
import { notifyRentDueSoon, notifyRentOverdue } from './notification.service';
import { getLeaseBalance } from './lease.service';
import { logger } from '../utils/logger';

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

const DUE_SOON_THRESHOLDS: { days: number; type: ReminderType }[] = [
  { days: 7, type: 'due_soon_7' },
  { days: 3, type: 'due_soon_3' },
  { days: 0, type: 'due_today' },
];

const OVERDUE_THRESHOLDS: { days: number; type: ReminderType }[] = [
  { days: 7, type: 'overdue_7' },
  { days: 30, type: 'overdue_30' },
  { days: 90, type: 'overdue_90' },
];

// Runs once a day (see jobs/rentReminderScheduler.ts). Thresholds are matched
// on the exact day, deduped via rent_reminders - if a sweep is skipped on the
// exact day (downtime), that reminder is missed rather than sent late/twice.
export async function sendDueReminders(asOf: Date = new Date()): Promise<{ sent: number }> {
  const leases = await findAllActiveLeasesWithTenant();
  let sent = 0;

  for (const lease of leases) {
    try {
      const balance = await getLeaseBalance(lease.id, asOf);

      const nextDue = new Date(`${balance.nextDueDate}T00:00:00.000Z`);
      const daysUntilNextDue = daysBetween(asOf, nextDue);
      const dueSoonMatch = DUE_SOON_THRESHOLDS.find((t) => t.days === daysUntilNextDue);
      if (dueSoonMatch && !(await hasReminderBeenSent(lease.id, balance.nextDueDate, dueSoonMatch.type))) {
        await notifyRentDueSoon({
          tenantEmail: lease.tenantEmail,
          tenantName: lease.tenantName,
          propertyAddress: lease.address,
          dueDate: balance.nextDueDate,
          amount: Number(lease.rentAmount),
        });
        await recordReminderSent(lease.id, balance.nextDueDate, dueSoonMatch.type);
        sent++;
      }

      if (balance.balance > 0) {
        const overdueMatch = OVERDUE_THRESHOLDS.find((t) => t.days === balance.daysOverdue);
        if (overdueMatch && !(await hasReminderBeenSent(lease.id, balance.currentDueDate, overdueMatch.type))) {
          await notifyRentOverdue({
            tenantEmail: lease.tenantEmail,
            tenantName: lease.tenantName,
            propertyAddress: lease.address,
            dueDate: balance.currentDueDate,
            amountOwed: balance.balance,
            daysOverdue: balance.daysOverdue,
          });
          await recordReminderSent(lease.id, balance.currentDueDate, overdueMatch.type);
          sent++;
        }
      }
    } catch (err) {
      logger.error(`Rent reminder check failed for lease ${lease.id}: ${err}`);
    }
  }

  return { sent };
}
