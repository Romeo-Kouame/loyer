import { pool } from '../config/database';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'disputed' | 'refunded';
export type PaymentProvider = 'mtn' | 'orange';
export type DisputeResolution = 'confirmed' | 'refunded';

export interface PaymentRecord {
  id: string;
  tenantId: string;
  propertyId: string;
  leaseId: string | null;
  amount: string;
  provider: PaymentProvider | null;
  transactionId: string | null;
  providerReference: string | null;
  status: PaymentStatus;
  disputeReason: string | null;
  disputedBy: string | null;
  disputedAt: Date | null;
  disputeResolution: DisputeResolution | null;
  disputeResolutionNotes: string | null;
  disputeResolvedAt: Date | null;
  createdAt: Date;
  webhookReceivedAt: Date | null;
}

const PAYMENT_COLUMNS = `id, "tenantId", "propertyId", "leaseId", amount, provider,
  "transactionId", "providerReference", status, "disputeReason", "disputedBy", "disputedAt",
  "disputeResolution", "disputeResolutionNotes", "disputeResolvedAt", "createdAt", "webhookReceivedAt"`;

export async function createPendingPayment(params: {
  tenantId: string;
  propertyId: string;
  leaseId: string;
  amount: number;
}): Promise<PaymentRecord> {
  const result = await pool.query<PaymentRecord>(
    `INSERT INTO "payments" ("tenantId", "propertyId", "leaseId", amount, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING ${PAYMENT_COLUMNS}`,
    [params.tenantId, params.propertyId, params.leaseId, params.amount]
  );
  return result.rows[0];
}

export async function setPaymentInitiated(
  id: string,
  params: { transactionId: string; providerReference: string | null; status: PaymentStatus }
): Promise<PaymentRecord> {
  const result = await pool.query<PaymentRecord>(
    `UPDATE "payments"
     SET "transactionId" = $2, "providerReference" = $3, status = $4, "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${PAYMENT_COLUMNS}`,
    [id, params.transactionId, params.providerReference, params.status]
  );
  return result.rows[0];
}

export async function findPaymentById(id: string): Promise<PaymentRecord | null> {
  const result = await pool.query<PaymentRecord>(
    `SELECT ${PAYMENT_COLUMNS}
     FROM "payments" WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findPaymentByTransactionId(transactionId: string): Promise<PaymentRecord | null> {
  const result = await pool.query<PaymentRecord>(
    `SELECT ${PAYMENT_COLUMNS}
     FROM "payments" WHERE "transactionId" = $1`,
    [transactionId]
  );
  return result.rows[0] ?? null;
}

export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  options: { webhookReceivedAt?: Date; provider?: PaymentProvider | null } = {}
): Promise<PaymentRecord> {
  const result = await pool.query<PaymentRecord>(
    `UPDATE "payments"
     SET status = $2,
         "updatedAt" = CURRENT_TIMESTAMP,
         "webhookReceivedAt" = COALESCE($3, "webhookReceivedAt"),
         provider = COALESCE($4, provider)
     WHERE id = $1
     RETURNING ${PAYMENT_COLUMNS}`,
    [id, status, options.webhookReceivedAt ?? null, options.provider ?? null]
  );
  return result.rows[0];
}

export async function openPaymentDispute(
  id: string,
  params: { disputeReason: string; disputedBy: string }
): Promise<PaymentRecord> {
  const result = await pool.query<PaymentRecord>(
    `UPDATE "payments"
     SET status = 'disputed', "disputeReason" = $2, "disputedBy" = $3, "disputedAt" = CURRENT_TIMESTAMP,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${PAYMENT_COLUMNS}`,
    [id, params.disputeReason, params.disputedBy]
  );
  return result.rows[0];
}

export async function resolvePaymentDispute(
  id: string,
  params: { resolution: DisputeResolution; notes?: string | null }
): Promise<PaymentRecord> {
  const newStatus: PaymentStatus = params.resolution === 'confirmed' ? 'confirmed' : 'refunded';
  const result = await pool.query<PaymentRecord>(
    `UPDATE "payments"
     SET status = $2, "disputeResolution" = $3, "disputeResolutionNotes" = $4, "disputeResolvedAt" = CURRENT_TIMESTAMP,
         "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${PAYMENT_COLUMNS}`,
    [id, newStatus, params.resolution, params.notes ?? null]
  );
  return result.rows[0];
}

export async function listDisputedPayments(params: {
  limit: number;
  offset: number;
}): Promise<{ payments: PaymentRecord[]; total: number }> {
  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM "payments" WHERE status = 'disputed'`
  );

  const paymentsResult = await pool.query<PaymentRecord>(
    `SELECT ${PAYMENT_COLUMNS} FROM "payments" WHERE status = 'disputed'
     ORDER BY "disputedAt" ASC
     LIMIT $1 OFFSET $2`,
    [params.limit, params.offset]
  );

  return { payments: paymentsResult.rows, total: Number(countResult.rows[0].count) };
}
