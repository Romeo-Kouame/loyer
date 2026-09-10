import { pool } from '../config/database';

export interface PasswordResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export async function createPasswordResetToken(params: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<PasswordResetTokenRecord> {
  const result = await pool.query<PasswordResetTokenRecord>(
    `INSERT INTO "password_reset_tokens" ("userId", "tokenHash", "expiresAt")
     VALUES ($1, $2, $3)
     RETURNING id, "userId", "tokenHash", "expiresAt", "usedAt"`,
    [params.userId, params.tokenHash, params.expiresAt]
  );
  return result.rows[0];
}

export async function findValidPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  const result = await pool.query<PasswordResetTokenRecord>(
    `SELECT id, "userId", "tokenHash", "expiresAt", "usedAt" FROM "password_reset_tokens"
     WHERE "tokenHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > CURRENT_TIMESTAMP`,
    [tokenHash]
  );
  return result.rows[0] ?? null;
}

export async function markPasswordResetTokenUsed(id: string): Promise<void> {
  await pool.query('UPDATE "password_reset_tokens" SET "usedAt" = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

// Invalidates any other outstanding reset links for the user once one of
// them has been used, so a leaked-but-unused older link can't still work.
export async function invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
  await pool.query(
    'UPDATE "password_reset_tokens" SET "usedAt" = CURRENT_TIMESTAMP WHERE "userId" = $1 AND "usedAt" IS NULL',
    [userId]
  );
}
