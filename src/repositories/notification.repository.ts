import { pool } from '../config/database';

export interface NotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  propertyId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

const NOTIFICATION_COLUMNS = 'id, "userId", type, title, body, "propertyId", "readAt", "createdAt"';

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  body?: string;
  propertyId?: string;
}): Promise<NotificationRecord> {
  const result = await pool.query<NotificationRecord>(
    `INSERT INTO "notifications" ("userId", type, title, body, "propertyId")
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${NOTIFICATION_COLUMNS}`,
    [params.userId, params.type, params.title, params.body ?? null, params.propertyId ?? null]
  );
  return result.rows[0];
}

export async function listNotificationsForUser(userId: string, limit = 20): Promise<NotificationRecord[]> {
  const result = await pool.query<NotificationRecord>(
    `SELECT ${NOTIFICATION_COLUMNS} FROM "notifications" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM "notifications" WHERE "userId" = $1 AND "readAt" IS NULL',
    [userId]
  );
  return Number(result.rows[0].count);
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  await pool.query(
    'UPDATE "notifications" SET "readAt" = CURRENT_TIMESTAMP WHERE id = $1 AND "userId" = $2 AND "readAt" IS NULL',
    [id, userId]
  );
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await pool.query(
    'UPDATE "notifications" SET "readAt" = CURRENT_TIMESTAMP WHERE "userId" = $1 AND "readAt" IS NULL',
    [userId]
  );
}
