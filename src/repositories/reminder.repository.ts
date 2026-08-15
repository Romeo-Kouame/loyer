import { pool } from '../config/database';

export type ReminderType = 'due_soon_7' | 'due_soon_3' | 'due_today' | 'overdue_7' | 'overdue_30' | 'overdue_90';

export interface ReminderNotification {
  id: string;
  reminderType: ReminderType;
  periodDueDate: string;
  sentAt: Date;
  address: string;
}

export async function listRemindersForTenant(tenantId: string, limit = 20): Promise<ReminderNotification[]> {
  const result = await pool.query<ReminderNotification>(
    `SELECT r.id, r."reminderType", r."periodDueDate", r."sentAt", p.address
     FROM "rent_reminders" r
     JOIN "leases" l ON l.id = r."leaseId"
     JOIN "properties" p ON p.id = l."propertyId"
     WHERE l."tenantId" = $1
     ORDER BY r."sentAt" DESC
     LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows;
}

export async function hasReminderBeenSent(
  leaseId: string,
  periodDueDate: string,
  reminderType: ReminderType
): Promise<boolean> {
  const result = await pool.query(
    `SELECT 1
     FROM "rent_reminders" WHERE "leaseId" = $1 AND "periodDueDate" = $2 AND "reminderType" = $3`,
    [leaseId, periodDueDate, reminderType]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function recordReminderSent(
  leaseId: string,
  periodDueDate: string,
  reminderType: ReminderType
): Promise<void> {
  await pool.query(
    `INSERT INTO "rent_reminders" ("leaseId", "periodDueDate", "reminderType")
     VALUES ($1, $2, $3)
     ON CONFLICT ("leaseId", "periodDueDate", "reminderType") DO NOTHING`,
    [leaseId, periodDueDate, reminderType]
  );
}
