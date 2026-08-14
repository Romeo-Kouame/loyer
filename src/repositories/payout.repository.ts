import { pool } from '../config/database';

export type PayoutStatus = 'pending' | 'on_hold' | 'processing' | 'completed' | 'failed';

export interface PayoutRecord {
  id: string;
  paymentId: string;
  landlordId: string;
  grossAmount: string;
  commissionAmount: string;
  payoutAmount: string;
  status: PayoutStatus;
  holdReason: string | null;
  transactionId: string | null;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

const PAYOUT_COLUMNS = `id, "paymentId", "landlordId", "grossAmount", "commissionAmount", "payoutAmount",
  status, "holdReason", "transactionId", "providerReference", "failureReason", "createdAt", "completedAt"`;

export async function createPayout(params: {
  paymentId: string;
  landlordId: string;
  grossAmount: number;
  commissionAmount: number;
  payoutAmount: number;
  status: PayoutStatus;
  holdReason?: string | null;
}): Promise<PayoutRecord> {
  const result = await pool.query<PayoutRecord>(
    `INSERT INTO "payouts" ("paymentId", "landlordId", "grossAmount", "commissionAmount", "payoutAmount", status, "holdReason")
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${PAYOUT_COLUMNS}`,
    [
      params.paymentId,
      params.landlordId,
      params.grossAmount,
      params.commissionAmount,
      params.payoutAmount,
      params.status,
      params.holdReason ?? null,
    ]
  );
  return result.rows[0];
}

export async function findPayoutById(id: string): Promise<PayoutRecord | null> {
  const result = await pool.query<PayoutRecord>(`SELECT ${PAYOUT_COLUMNS} FROM "payouts" WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

export async function findPayoutByPaymentId(paymentId: string): Promise<PayoutRecord | null> {
  const result = await pool.query<PayoutRecord>(`SELECT ${PAYOUT_COLUMNS} FROM "payouts" WHERE "paymentId" = $1`, [
    paymentId,
  ]);
  return result.rows[0] ?? null;
}

export async function findPayoutByTransactionId(transactionId: string): Promise<PayoutRecord | null> {
  const result = await pool.query<PayoutRecord>(
    `SELECT ${PAYOUT_COLUMNS} FROM "payouts" WHERE "transactionId" = $1`,
    [transactionId]
  );
  return result.rows[0] ?? null;
}

export async function setPayoutProcessing(
  id: string,
  params: { transactionId: string; providerReference: string | null }
): Promise<PayoutRecord> {
  const result = await pool.query<PayoutRecord>(
    `UPDATE "payouts"
     SET status = 'processing', "transactionId" = $2, "providerReference" = $3, "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${PAYOUT_COLUMNS}`,
    [id, params.transactionId, params.providerReference]
  );
  return result.rows[0];
}

export async function setPayoutStatus(
  id: string,
  params: { status: PayoutStatus; failureReason?: string | null; completedAt?: Date }
): Promise<PayoutRecord> {
  const result = await pool.query<PayoutRecord>(
    `UPDATE "payouts"
     SET status = $2, "failureReason" = $3, "completedAt" = COALESCE($4, "completedAt"), "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${PAYOUT_COLUMNS}`,
    [id, params.status, params.failureReason ?? null, params.completedAt ?? null]
  );
  return result.rows[0];
}

export async function listPayoutsForLandlord(params: {
  landlordId: string;
  limit: number;
  offset: number;
}): Promise<{ payouts: PayoutRecord[]; total: number }> {
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM "payouts" WHERE "landlordId" = $1`,
    [params.landlordId]
  );

  const payoutsResult = await pool.query<PayoutRecord>(
    `SELECT ${PAYOUT_COLUMNS} FROM "payouts" WHERE "landlordId" = $1
     ORDER BY "createdAt" DESC
     LIMIT $2 OFFSET $3`,
    [params.landlordId, params.limit, params.offset]
  );

  return { payouts: payoutsResult.rows, total: Number(countResult.rows[0].count) };
}
