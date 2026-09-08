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

// Surfaces the most urgent requests first regardless of when they were filed,
// so a landlord (or tenant, on their own list) sees what actually needs
// attention before what's merely most recent.
function severityOrderSql(column: string): string {
  return `CASE ${column}
    WHEN 'urgent' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
    ELSE 4
  END`;
}

export async function listMaintenanceRequestsForTenant(tenantId: string): Promise<MaintenanceRequestRecord[]> {
  const result = await pool.query<MaintenanceRequestRecord>(
    `SELECT ${COLUMNS} FROM "maintenance_requests" WHERE "reportedBy" = $1
     ORDER BY ${severityOrderSql('severity')}, "createdAt" DESC`,
    [tenantId]
  );
  return result.rows;
}

export interface MaintenanceRequestWithPropertyRecord extends MaintenanceRequestRecord {
  propertyAddress: string;
  unitLabel: string | null;
}

export async function listMaintenanceRequestsForLandlord(
  landlordId: string
): Promise<MaintenanceRequestWithPropertyRecord[]> {
  const result = await pool.query<MaintenanceRequestWithPropertyRecord>(
    `SELECT m.id, m."propertyId", m."leaseId", m."reportedBy", m."issueType", m.description, m.severity,
            m."photoPath", m."photoMimeType", m.status, m."createdAt", m."updatedAt", m."resolvedAt",
            p.address AS "propertyAddress", l."unitLabel"
     FROM "maintenance_requests" m
     JOIN "properties" p ON p.id = m."propertyId"
     LEFT JOIN "leases" l ON l.id = m."leaseId"
     WHERE p."ownerId" = $1
     ORDER BY ${severityOrderSql('m.severity')}, m."createdAt" DESC`,
    [landlordId]
  );
  return result.rows;
}

export async function countPendingRequestsForLandlord(landlordId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM "maintenance_requests" m
     JOIN "properties" p ON p.id = m."propertyId"
     WHERE p."ownerId" = $1 AND m.status IN ('open', 'in_progress')`,
    [landlordId]
  );
  return Number(result.rows[0].count);
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

export async function updateMaintenanceRequestSeverity(
  id: string,
  severity: MaintenanceSeverity
): Promise<MaintenanceRequestRecord> {
  const result = await pool.query<MaintenanceRequestRecord>(
    `UPDATE "maintenance_requests"
     SET severity = $2, "updatedAt" = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING ${COLUMNS}`,
    [id, severity]
  );
  return result.rows[0];
}

export interface MaintenanceCommentRecord {
  id: string;
  requestId: string;
  authorId: string;
  body: string;
  createdAt: Date;
}

export interface MaintenanceCommentWithAuthor extends MaintenanceCommentRecord {
  authorName: string;
}

export async function listCommentsForRequest(requestId: string): Promise<MaintenanceCommentWithAuthor[]> {
  const result = await pool.query<MaintenanceCommentWithAuthor>(
    `SELECT c.id, c."requestId", c."authorId", c.body, c."createdAt", u.name AS "authorName"
     FROM "maintenance_request_comments" c
     JOIN "users" u ON u.id = c."authorId"
     WHERE c."requestId" = $1
     ORDER BY c."createdAt" ASC`,
    [requestId]
  );
  return result.rows;
}

export async function createComment(params: {
  requestId: string;
  authorId: string;
  body: string;
}): Promise<MaintenanceCommentRecord> {
  const result = await pool.query<MaintenanceCommentRecord>(
    `INSERT INTO "maintenance_request_comments" ("requestId", "authorId", body)
     VALUES ($1, $2, $3)
     RETURNING id, "requestId", "authorId", body, "createdAt"`,
    [params.requestId, params.authorId, params.body]
  );
  return result.rows[0];
}
