import { pool } from '../config/database';

export interface UserRecord {
  id: string;
  email: string;
  phone: string;
  name: string;
  passwordHash: string;
  role: 'landlord' | 'tenant' | 'admin';
  kycStatus: 'pending' | 'verified' | 'rejected';
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT id, email, phone, name, "passwordHash", role, "kycStatus"
     FROM "users" WHERE email = $1 AND "deletedAt" IS NULL`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT id, email, phone, name, "passwordHash", role, "kycStatus"
     FROM "users" WHERE id = $1 AND "deletedAt" IS NULL`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createUser(params: {
  email: string;
  phone: string;
  name: string;
  passwordHash: string;
  role: 'landlord' | 'tenant';
}): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, phone, name, "passwordHash", role, "kycStatus"`,
    [params.email, params.phone, params.name, params.passwordHash, params.role]
  );
  return result.rows[0];
}
