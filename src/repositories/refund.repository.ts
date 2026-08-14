import { pool } from '../config/database';

export type RefundStatus = 'pending' | 'completed' | 'rejected';

export interface RefundRecord {
  id: string;
  paymentId: string;
  requestedBy: string;
  reason: string | null;
  status: RefundStatus;
  payoutAlreadySent: boolean;
  adminNotes: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

const REFUND_COLUMNS = `id, "paymentId", "requestedBy", reason, status, "payoutAlreadySent",
  "adminNotes", "createdAt", "completedAt"`;

export async function createRefund(params: {
  paymentId: string;
  requestedBy: string;
  reason?: string | null;
  payoutAlreadySent: boolean;
}): Promise<RefundRecord> {
  const result = await pool.query<RefundRecord>(
    `INSERT INTO "refunds" ("paymentId", "requestedBy", reason, "payoutAlreadySent")
     VALUES ($1, $2, $3, $4)
     RETURNING ${REFUND_COLUMNS}`,
    [params.paymentId, params.requestedBy, params.reason ?? null, params.payoutAlreadySent]
  );
  return result.rows[0];
}

export async function findRefundById(id: string): Promise<RefundRecord | null> {
  const result = await pool.query<RefundRecord>(`SELECT ${REFUND_COLUMNS} FROM "refunds" WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function markRefundCompleted(id: string, adminNotes?: string | null): Promise<RefundRecord> {
  const result = await pool.query<RefundRecord>(
    `UPDATE "refunds"
     SET status = 'completed', "adminNotes" = COALESCE($2, "adminNotes"), "completedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${REFUND_COLUMNS}`,
    [id, adminNotes ?? null]
  );
  return result.rows[0];
}

export async function listRefunds(params: {
  status?: RefundStatus;
  limit: number;
  offset: number;
}): Promise<{ refunds: RefundRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.status) {
    values.push(params.status);
    conditions.push(`status = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "refunds" ${whereClause}`,
    values
  );

  values.push(params.limit);
  values.push(params.offset);

  const refundsResult = await pool.query<RefundRecord>(
    `SELECT ${REFUND_COLUMNS} FROM "refunds" ${whereClause}
     ORDER BY "createdAt" ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { refunds: refundsResult.rows, total: Number(countResult.rows[0].count) };
}
