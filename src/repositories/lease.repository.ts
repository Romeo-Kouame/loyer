import { pool } from '../config/database';

export type LeaseStatus = 'active' | 'ended';

export interface LeaseRecord {
  id: string;
  propertyId: string;
  tenantId: string;
  status: LeaseStatus;
  unitLabel: string | null;
  rentAmount: string;
  moveInDate: string;
  installmentsAllowed: boolean;
  createdAt: Date;
}

export interface LeaseWithProperty extends LeaseRecord {
  address: string;
  numberOfApartments: number;
}

const LEASE_COLUMNS = `id, "propertyId", "tenantId", status, "unitLabel", "rentAmount",
  "moveInDate", "installmentsAllowed", "createdAt"`;

export async function createLease(params: {
  propertyId: string;
  tenantId: string;
  unitLabel: string;
  rentAmount: number;
  moveInDate: string;
  installmentsAllowed: boolean;
}): Promise<LeaseRecord> {
  const result = await pool.query<LeaseRecord>(
    `INSERT INTO "leases" ("propertyId", "tenantId", status, "unitLabel", "rentAmount", "moveInDate", "installmentsAllowed")
     VALUES ($1, $2, 'active', $3, $4, $5, $6)
     RETURNING ${LEASE_COLUMNS}`,
    [params.propertyId, params.tenantId, params.unitLabel, params.rentAmount, params.moveInDate, params.installmentsAllowed]
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

export async function findActiveLeaseByUnit(propertyId: string, unitLabel: string): Promise<LeaseRecord | null> {
  const result = await pool.query<LeaseRecord>(
    `SELECT ${LEASE_COLUMNS}
     FROM "leases" WHERE "propertyId" = $1 AND "unitLabel" = $2 AND status = 'active'`,
    [propertyId, unitLabel]
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
    `SELECT l.id, l."propertyId", l."tenantId", l.status, l."unitLabel", l."rentAmount", l."moveInDate", l."installmentsAllowed", l."createdAt",
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

export interface LeaseWithTenant extends LeaseRecord {
  tenantName: string;
  tenantEmail: string;
}

export async function findActiveLeasesForProperty(propertyId: string): Promise<LeaseWithTenant[]> {
  const result = await pool.query<LeaseWithTenant>(
    `SELECT l.id, l."propertyId", l."tenantId", l.status, l."unitLabel", l."rentAmount", l."moveInDate", l."installmentsAllowed", l."createdAt",
            u.name AS "tenantName", u.email AS "tenantEmail"
     FROM "leases" l
     JOIN "users" u ON u.id = l."tenantId"
     WHERE l."propertyId" = $1 AND l.status = 'active'
     ORDER BY l."unitLabel" ASC NULLS LAST, l."createdAt" DESC`,
    [propertyId]
  );
  return result.rows;
}

export async function findAllActiveLeasesForLandlord(landlordId: string): Promise<LeaseRecord[]> {
  const result = await pool.query<LeaseRecord>(
    `SELECT l.id, l."propertyId", l."tenantId", l.status, l."unitLabel", l."rentAmount", l."moveInDate", l."installmentsAllowed", l."createdAt"
     FROM "leases" l
     JOIN "properties" p ON p.id = l."propertyId"
     WHERE p."ownerId" = $1 AND l.status = 'active' AND p."deletedAt" IS NULL`,
    [landlordId]
  );
  return result.rows;
}

export async function countActiveLeasesForLandlord(landlordId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM "leases" l
     JOIN "properties" p ON p.id = l."propertyId"
     WHERE p."ownerId" = $1 AND l.status = 'active' AND p."deletedAt" IS NULL`,
    [landlordId]
  );
  return Number(result.rows[0].count);
}

export interface ActiveLeaseForReminder extends LeaseRecord {
  tenantName: string;
  tenantEmail: string;
  address: string;
}

export async function findAllActiveLeasesWithTenant(): Promise<ActiveLeaseForReminder[]> {
  const result = await pool.query<ActiveLeaseForReminder>(
    `SELECT l.id, l."propertyId", l."tenantId", l.status, l."unitLabel", l."rentAmount", l."moveInDate", l."installmentsAllowed", l."createdAt",
            u.name AS "tenantName", u.email AS "tenantEmail", p.address
     FROM "leases" l
     JOIN "users" u ON u.id = l."tenantId"
     JOIN "properties" p ON p.id = l."propertyId"
     WHERE l.status = 'active' AND p."deletedAt" IS NULL AND u."emailRemindersEnabled" = true`
  );
  return result.rows;
}
