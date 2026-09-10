import { pool } from '../config/database';

export interface PassportTokenRecord {
  id: string;
  tenantId: string;
  token: string;
  createdAt: Date;
  revokedAt: Date | null;
}

const COLUMNS = 'id, "tenantId", token, "createdAt", "revokedAt"';

export async function findActivePassportToken(tenantId: string): Promise<PassportTokenRecord | null> {
  const result = await pool.query<PassportTokenRecord>(
    `SELECT ${COLUMNS} FROM "tenant_passport_tokens"
     WHERE "tenantId" = $1 AND "revokedAt" IS NULL
     ORDER BY "createdAt" DESC LIMIT 1`,
    [tenantId]
  );
  return result.rows[0] ?? null;
}

export async function createPassportToken(tenantId: string, token: string): Promise<PassportTokenRecord> {
  const result = await pool.query<PassportTokenRecord>(
    `INSERT INTO "tenant_passport_tokens" ("tenantId", token) VALUES ($1, $2)
     RETURNING ${COLUMNS}`,
    [tenantId, token]
  );
  return result.rows[0];
}

export async function findPassportTokenByToken(token: string): Promise<PassportTokenRecord | null> {
  const result = await pool.query<PassportTokenRecord>(
    `SELECT ${COLUMNS} FROM "tenant_passport_tokens" WHERE token = $1 AND "revokedAt" IS NULL`,
    [token]
  );
  return result.rows[0] ?? null;
}

export async function revokeActivePassportTokens(tenantId: string): Promise<void> {
  await pool.query(
    `UPDATE "tenant_passport_tokens" SET "revokedAt" = CURRENT_TIMESTAMP
     WHERE "tenantId" = $1 AND "revokedAt" IS NULL`,
    [tenantId]
  );
}
