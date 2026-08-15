import { pool } from '../config/database';

export type MaintenanceSeverity = 'low' | 'medium' | 'high' | 'urgent';
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface MaintenanceRequestRecord {
  id: string;
  propertyId: string;
  leaseId: string;
  reportedBy: string;
  issueType: string;
  description: string;
  severity: MaintenanceSeverity;
  photoPath: string | null;
  photoMimeType: string | null;
  status: MaintenanceStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

const COLUMNS = `id, "propertyId", "leaseId", "reportedBy", "issueType", description, severity,
  "photoPath", "photoMimeType", status, "createdAt", "updatedAt", "resolvedAt"`;

export async function createMaintenanceRequest(params: {
  propertyId: string;
  leaseId: string;
  reportedBy: string;
  issueType: string;
  description: string;
  severity: MaintenanceSeverity;
  photoPath: string | null;
  photoMimeType: string | null;
}): Promise<MaintenanceRequestRecord> {
  const result = await pool.query<MaintenanceRequestRecord>(
    `INSERT INTO "maintenance_requests"
       ("propertyId", "leaseId", "reportedBy", "issueType", description, severity, "photoPath", "photoMimeType")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNS}`,
    [
      params.propertyId,
      params.leaseId,
      params.reportedBy,
      params.issueType,
      params.description,
      params.severity,
      params.photoPath,
      params.photoMimeType,
    ]
  );
  return result.rows[0];
}

export async function findMaintenanceRequestById(id: string): Promise<MaintenanceRequestRecord | null> {
  const result = await pool.query<MaintenanceRequestRecord>(
    `SELECT ${COLUMNS} FROM "maintenance_requests" WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listMaintenanceRequestsForTenant(tenantId: string): Promise<MaintenanceRequestRecord[]> {
  const result = await pool.query<MaintenanceRequestRecord>(
    `SELECT ${COLUMNS} FROM "maintenance_requests" WHERE "reportedBy" = $1 ORDER BY "createdAt" DESC`,
    [tenantId]
  );
  return result.rows;
}

export async function listMaintenanceRequestsForLandlord(landlordId: string): Promise<MaintenanceRequestRecord[]> {
  const result = await pool.query<MaintenanceRequestRecord>(
    `SELECT m.id, m."propertyId", m."leaseId", m."reportedBy", m."issueType", m.description, m.severity,
            m."photoPath", m."photoMimeType", m.status, m."createdAt", m."updatedAt", m."resolvedAt"
     FROM "maintenance_requests" m
     JOIN "properties" p ON p.id = m."propertyId"
     WHERE p."ownerId" = $1
     ORDER BY m."createdAt" DESC`,
    [landlordId]
  );
  return result.rows;
}

export async function updateMaintenanceRequestStatus(
  id: string,
  status: MaintenanceStatus
): Promise<MaintenanceRequestRecord> {
  const result = await pool.query<MaintenanceRequestRecord>(
    `UPDATE "maintenance_requests"
     SET status = $2::VARCHAR(20),
         "updatedAt" = CURRENT_TIMESTAMP,
         "resolvedAt" = CASE WHEN $2::VARCHAR(20) = 'resolved' THEN CURRENT_TIMESTAMP ELSE "resolvedAt" END
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, status]
  );
  return result.rows[0];
}
