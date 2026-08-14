import { pool } from '../config/database';

export type PropertyVerificationStatus = 'unverified' | 'pending_review' | 'verified' | 'rejected';

export interface PropertyRecord {
  id: string;
  ownerId: string;
  address: string;
  numberOfApartments: number;
  verificationStatus: PropertyVerificationStatus;
  verificationDocumentPath: string | null;
  verificationDocumentMimeType: string | null;
  verificationSubmittedAt: Date | null;
  verificationReviewedAt: Date | null;
  verificationRejectionReason: string | null;
}

const PROPERTY_COLUMNS = `id, "ownerId", address, "numberOfApartments", "verificationStatus",
  "verificationDocumentPath", "verificationDocumentMimeType", "verificationSubmittedAt",
  "verificationReviewedAt", "verificationRejectionReason"`;

export async function findPropertyById(id: string): Promise<PropertyRecord | null> {
  const result = await pool.query<PropertyRecord>(
    `SELECT ${PROPERTY_COLUMNS} FROM "properties" WHERE id = $1 AND "deletedAt" IS NULL`,
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
     RETURNING ${PROPERTY_COLUMNS}`,
    [params.ownerId, params.address, params.numberOfApartments]
  );
  return result.rows[0];
}

export async function findPropertiesByOwnerId(ownerId: string): Promise<PropertyRecord[]> {
  const result = await pool.query<PropertyRecord>(
    `SELECT ${PROPERTY_COLUMNS} FROM "properties" WHERE "ownerId" = $1 AND "deletedAt" IS NULL
     ORDER BY "createdAt" DESC`,
    [ownerId]
  );
  return result.rows;
}

export async function submitVerificationDocument(
  propertyId: string,
  params: { documentPath: string; documentMimeType: string }
): Promise<PropertyRecord> {
  const result = await pool.query<PropertyRecord>(
    `UPDATE "properties"
     SET "verificationStatus" = 'pending_review',
         "verificationDocumentPath" = $2,
         "verificationDocumentMimeType" = $3,
         "verificationSubmittedAt" = CURRENT_TIMESTAMP,
         "verificationReviewedAt" = NULL,
         "verificationRejectionReason" = NULL
     WHERE id = $1
     RETURNING ${PROPERTY_COLUMNS}`,
    [propertyId, params.documentPath, params.documentMimeType]
  );
  return result.rows[0];
}

export async function reviewVerification(
  propertyId: string,
  params: { status: 'verified' | 'rejected'; rejectionReason?: string | null }
): Promise<PropertyRecord> {
  const result = await pool.query<PropertyRecord>(
    `UPDATE "properties"
     SET "verificationStatus" = $2, "verificationReviewedAt" = CURRENT_TIMESTAMP, "verificationRejectionReason" = $3
     WHERE id = $1
     RETURNING ${PROPERTY_COLUMNS}`,
    [propertyId, params.status, params.rejectionReason ?? null]
  );
  return result.rows[0];
}

export async function listPropertiesByVerificationStatus(params: {
  status?: PropertyVerificationStatus;
  limit: number;
  offset: number;
}): Promise<{ properties: PropertyRecord[]; total: number }> {
  const conditions = ['"deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (params.status) {
    values.push(params.status);
    conditions.push(`"verificationStatus" = $${values.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "properties" ${whereClause}`,
    values
  );

  values.push(params.limit);
  values.push(params.offset);

  const propertiesResult = await pool.query<PropertyRecord>(
    `SELECT ${PROPERTY_COLUMNS} FROM "properties" ${whereClause}
     ORDER BY "verificationSubmittedAt" ASC NULLS LAST
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { properties: propertiesResult.rows, total: Number(countResult.rows[0].count) };
}
