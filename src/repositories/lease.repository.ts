import { pool } from '../config/database';

export type LeaseStatus = 'active' | 'ended';

export interface LeaseRecord {
  id: string;
  propertyId: string;
  tenantId: string;
  status: LeaseStatus;
  rentAmount: string;
  moveInDate: string;
  installmentsAllowed: boolean;
  createdAt: Date;
}

export interface LeaseWithProperty extends LeaseRecord {
  address: string;
  numberOfApartments: number;
}

const LEASE_COLUMNS = `id, "propertyId", "tenantId", status, "rentAmount",
  "moveInDate", "installmentsAllowed", "createdAt"`;

export async function createLease(params: {
  propertyId: string;
  tenantId: string;
  rentAmount: number;
  moveInDate: string;
  installmentsAllowed: boolean;
}): Promise<LeaseRecord> {
  const result = await pool.query<LeaseRecord>(
    `INSERT INTO "leases" ("propertyId", "tenantId", status, "rentAmount", "moveInDate", "installmentsAllowed")
     VALUES ($1, $2, 'active', $3, $4, $5)
     RETURNING ${LEASE_COLUMNS}`,
    [params.propertyId, params.tenantId, params.rentAmount, params.moveInDate, params.installmentsAllowed]
  );
  return result.rows[0];
}

export async function findActiveLease(propertyId: string, tenantId: string): Promise<LeaseRecord | null> {
  const result = await pool.query<LeaseRecord>(
    `SELECT ${LEASE_COLUMNS}
     FROM "leases" WHERE "propertyId" = $1 AND "tenantId" = $2 AND status = 'active'`,
    [propertyId, tenantId]
  );
  return result.rows[0] ?? null;
}

export async function findLeaseById(id: string): Promise<LeaseRecord | null> {
  const result = await pool.query<LeaseRecord>(
    `SELECT ${LEASE_COLUMNS}
     FROM "leases" WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function endLease(id: string): Promise<LeaseRecord> {
  const result = await pool.query<LeaseRecord>(
    `UPDATE "leases" SET status = 'ended', "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${LEASE_COLUMNS}`,
    [id]
  );
  return result.rows[0];
}

export async function findActivePropertiesForTenant(tenantId: string): Promise<LeaseWithProperty[]> {
  const result = await pool.query<LeaseWithProperty>(
    `SELECT l.id, l."propertyId", l."tenantId", l.status, l."rentAmount", l."moveInDate", l."installmentsAllowed", l."createdAt",
            p.address, p."numberOfApartments"
     FROM "leases" l
     JOIN "properties" p ON p.id = l."propertyId"
     WHERE l."tenantId" = $1 AND l.status = 'active' AND p."deletedAt" IS NULL
     ORDER BY l."createdAt" DESC`,
    [tenantId]
  );
  return result.rows;
}

export async function sumConfirmedPaymentsForLease(leaseId: string): Promise<number> {
  const result = await pool.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM "payments" WHERE "leaseId" = $1 AND status = 'confirmed'`,
    [leaseId]
  );
  return Number(result.rows[0].total);
}
