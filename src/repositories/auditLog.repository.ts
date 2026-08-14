import { pool } from '../config/database';

export interface AuditLogRecord {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogEntry {
  userId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function insertAuditLog(entry: AuditLogEntry): Promise<void> {
  await pool.query(
    `INSERT INTO "audit_logs" ("userId", action, "resourceType", "resourceId", metadata, "ipAddress", "userAgent")
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.userId ?? null,
      entry.action,
      entry.resourceType ?? null,
      entry.resourceId ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
    ]
  );
}

export async function listAuditLogs(params: {
  limit: number;
  offset: number;
  userId?: string;
  action?: string;
}): Promise<{ logs: AuditLogRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (params.userId) {
    values.push(params.userId);
    conditions.push(`"userId" = $${values.length}`);
  }
  if (params.action) {
    values.push(params.action);
    conditions.push(`action = $${values.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "audit_logs" ${whereClause}`,
    values
  );

  values.push(params.limit);
  values.push(params.offset);

  const logsResult = await pool.query<AuditLogRecord>(
    `SELECT id, "userId", action, "resourceType", "resourceId", metadata, "ipAddress", "userAgent", "createdAt"
     FROM "audit_logs" ${whereClause}
     ORDER BY "createdAt" DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { logs: logsResult.rows, total: Number(countResult.rows[0].count) };
}
