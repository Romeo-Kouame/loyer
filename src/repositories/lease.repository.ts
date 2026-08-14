import { pool } from '../config/database';

export type LeaseStatus = 'active' | 'ended';

export interface LeaseRecord {
  id: string;
  propertyId: string;
  tenantId: string;
  status: LeaseStatus;
  createdAt: Date;
}

export interface LeaseWithProperty extends LeaseRecord {
  address: string;
  numberOfApartments: number;
}

export async function createLease(params: { propertyId: string; tenantId: string }): Promise<LeaseRecord> {
  const result = await pool.query<LeaseRecord>(
    `INSERT INTO "leases" ("propertyId", "tenantId", status)
     VALUES ($1, $2, 'active')
     RETURNING id, "propertyId", "tenantId", status, "createdAt"`,
    [params.propertyId, params.tenantId]
  );
  return result.rows[0];
}

export async function findActiveLease(propertyId: string, tenantId: string): Promise<LeaseRecord | null> {
  const result = await pool.query<LeaseRecord>(
    `SELECT id, "propertyId", "tenantId", status, "createdAt"
     FROM "leases" WHERE "propertyId" = $1 AND "tenantId" = $2 AND status = 'active'`,
    [propertyId, tenantId]
  );
  return result.rows[0] ?? null;
}

export async function findLeaseById(id: string): Promise<LeaseRecord | null> {
  const result = await pool.query<LeaseRecord>(
    `SELECT id, "propertyId", "tenantId", status, "createdAt"
     FROM "leases" WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function endLease(id: string): Promise<LeaseRecord> {
  const result = await pool.query<LeaseRecord>(
    `UPDATE "leases" SET status = 'ended', "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING id, "propertyId", "tenantId", status, "createdAt"`,
    [id]
  );
  return result.rows[0];
}

export async function findActivePropertiesForTenant(tenantId: string): Promise<LeaseWithProperty[]> {
  const result = await pool.query<LeaseWithProperty>(
    `SELECT l.id, l."propertyId", l."tenantId", l.status, l."createdAt",
            p.address, p."numberOfApartments"
     FROM "leases" l
     JOIN "properties" p ON p.id = l."propertyId"
     WHERE l."tenantId" = $1 AND l.status = 'active' AND p."deletedAt" IS NULL
     ORDER BY l."createdAt" DESC`,
    [tenantId]
  );
  return result.rows;
}
