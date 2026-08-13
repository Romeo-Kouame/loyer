import { pool } from '../config/database';

export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'disputed';
export type PaymentProvider = 'mtn' | 'orange';

export interface PaymentRecord {
  id: string;
  tenantId: string;
  propertyId: string;
  amount: string;
  provider: PaymentProvider | null;
  transactionId: string | null;
  providerReference: string | null;
  status: PaymentStatus;
  createdAt: Date;
  webhookReceivedAt: Date | null;
}

export async function createPendingPayment(params: {
  tenantId: string;
  propertyId: string;
  amount: number;
}): Promise<PaymentRecord> {
  const result = await pool.query<PaymentRecord>(
    `INSERT INTO "payments" ("tenantId", "propertyId", amount, status)
     VALUES ($1, $2, $3, 'pending')
     RETURNING id, "tenantId", "propertyId", amount, provider, "transactionId", "providerReference", status, "createdAt", "webhookReceivedAt"`,
    [params.tenantId, params.propertyId, params.amount]
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
     RETURNING id, "tenantId", "propertyId", amount, provider, "transactionId", "providerReference", status, "createdAt", "webhookReceivedAt"`,
    [id, params.transactionId, params.providerReference, params.status]
  );
  return result.rows[0];
}

export async function findPaymentById(id: string): Promise<PaymentRecord | null> {
  const result = await pool.query<PaymentRecord>(
    `SELECT id, "tenantId", "propertyId", amount, provider, "transactionId", "providerReference", status, "createdAt", "webhookReceivedAt"
     FROM "payments" WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function findPaymentByTransactionId(transactionId: string): Promise<PaymentRecord | null> {
  const result = await pool.query<PaymentRecord>(
    `SELECT id, "tenantId", "propertyId", amount, provider, "transactionId", "providerReference", status, "createdAt", "webhookReceivedAt"
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
     RETURNING id, "tenantId", "propertyId", amount, provider, "transactionId", "providerReference", status, "createdAt", "webhookReceivedAt"`,
    [id, status, options.webhookReceivedAt ?? null, options.provider ?? null]
  );
  return result.rows[0];
}
