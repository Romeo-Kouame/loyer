import { AuditLogEntry, insertAuditLog, listAuditLogs as listAuditLogsRecords } from '../repositories/auditLog.repository';
import { logger } from '../utils/logger';

// Best-effort: a logging failure must never break the business action it's
// attached to (login, payment initiation, etc.).
export async function logAction(entry: AuditLogEntry): Promise<void> {
  try {
    await insertAuditLog(entry);
  } catch (err) {
    logger.warn(`Failed to record audit log for action "${entry.action}": ${err}`);
  }
}

export async function listAuditLogs(params: { page?: number; pageSize?: number; userId?: string; action?: string }) {
  const pageSize = Math.min(Math.max(params.pageSize ?? 50, 1), 200);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const { logs, total } = await listAuditLogsRecords({
    limit: pageSize,
    offset,
    userId: params.userId,
    action: params.action,
  });

  return { logs, total, page, pageSize };
}
