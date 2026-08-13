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

export async function createProperty(params: {
  ownerId: string;
  address: string;
  numberOfApartments: number;
}): Promise<PropertyRecord> {
  const result = await pool.query<PropertyRecord>(
    `INSERT INTO "properties" ("ownerId", address, "numberOfApartments")
     VALUES ($1, $2, $3)
     RETURNING id, "ownerId", address, "numberOfApartments"`,
    [params.ownerId, params.address, params.numberOfApartments]
  );
  return result.rows[0];
}

export async function findPropertiesByOwnerId(ownerId: string): Promise<PropertyRecord[]> {
  const result = await pool.query<PropertyRecord>(
    `SELECT id, "ownerId", address, "numberOfApartments"
     FROM "properties" WHERE "ownerId" = $1 AND "deletedAt" IS NULL
     ORDER BY "createdAt" DESC`,
    [ownerId]
  );
  return result.rows;
}
