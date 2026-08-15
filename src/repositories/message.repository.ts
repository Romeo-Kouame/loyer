import { pool } from '../config/database';

export interface MessageRecord {
  id: string;
  leaseId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

const COLUMNS = `id, "leaseId", "senderId", body,
  "createdAt", "readAt"`;

export async function createMessage(params: {
  leaseId: string;
  senderId: string;
  body: string;
}): Promise<MessageRecord> {
  const result = await pool.query<MessageRecord>(
    `INSERT INTO "messages"
       ("leaseId", "senderId", body)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNS}`,
    [params.leaseId, params.senderId, params.body]
  );
  return result.rows[0];
}

export async function listMessagesForLease(leaseId: string): Promise<MessageRecord[]> {
  const result = await pool.query<MessageRecord>(
    `SELECT ${COLUMNS} FROM "messages" WHERE "leaseId" = $1 ORDER BY "createdAt" ASC`,
    [leaseId]
  );
  return result.rows;
}

export async function getLastMessage(leaseId: string): Promise<MessageRecord | null> {
  const result = await pool.query<MessageRecord>(
    `SELECT ${COLUMNS}
     FROM "messages" WHERE "leaseId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [leaseId]
  );
  return result.rows[0] ?? null;
}

export async function markMessagesRead(leaseId: string, readerId: string): Promise<void> {
  await pool.query(
    `UPDATE "messages"
     SET "readAt" = CURRENT_TIMESTAMP
     WHERE "leaseId" = $1 AND "senderId" != $2 AND "readAt" IS NULL`,
    [leaseId, readerId]
  );
}

export async function countUnreadForUser(leaseId: string, readerId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM "messages" WHERE "leaseId" = $1 AND "senderId" != $2 AND "readAt" IS NULL`,
    [leaseId, readerId]
  );
  return Number(result.rows[0].count);
}
