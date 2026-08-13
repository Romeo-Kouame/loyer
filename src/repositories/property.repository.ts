import { pool } from '../config/database';

export interface PropertyRecord {
  id: string;
  ownerId: string;
  address: string;
  numberOfApartments: number;
}

export async function findPropertyById(id: string): Promise<PropertyRecord | null> {
  const result = await pool.query<PropertyRecord>(
    `SELECT id, "ownerId", address, "numberOfApartments"
     FROM "properties" WHERE id = $1 AND "deletedAt" IS NULL`,
    [id]
  );
  return result.rows[0] ?? null;
}
