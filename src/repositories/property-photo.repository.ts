import { pool } from '../config/database';

export interface PropertyPhotoRecord {
  id: string;
  propertyId: string;
  path: string;
  mimeType: string;
  position: number;
  createdAt: Date;
}

const PHOTO_COLUMNS = 'id, "propertyId", path, "mimeType", position, "createdAt"';

export async function addPropertyPhoto(params: {
  propertyId: string;
  path: string;
  mimeType: string;
}): Promise<PropertyPhotoRecord> {
  const countResult = await pool.query<{ count: string }>(
    'SELECT COUNT(*) AS count FROM "property_photos" WHERE "propertyId" = $1',
    [params.propertyId]
  );
  const position = Number(countResult.rows[0].count);

  const result = await pool.query<PropertyPhotoRecord>(
    `INSERT INTO "property_photos" ("propertyId", path, "mimeType", position)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PHOTO_COLUMNS}`,
    [params.propertyId, params.path, params.mimeType, position]
  );
  return result.rows[0];
}

export async function listPropertyPhotos(propertyId: string): Promise<PropertyPhotoRecord[]> {
  const result = await pool.query<PropertyPhotoRecord>(
    `SELECT ${PHOTO_COLUMNS} FROM "property_photos"
     WHERE "propertyId" = $1
     ORDER BY position ASC, "createdAt" ASC`,
    [propertyId]
  );
  return result.rows;
}

export async function findCoverPhoto(propertyId: string): Promise<PropertyPhotoRecord | null> {
  const result = await pool.query<PropertyPhotoRecord>(
    `SELECT ${PHOTO_COLUMNS} FROM "property_photos"
     WHERE "propertyId" = $1
     ORDER BY position ASC, "createdAt" ASC
     LIMIT 1`,
    [propertyId]
  );
  return result.rows[0] ?? null;
}

export async function findPropertyPhotoById(id: string): Promise<PropertyPhotoRecord | null> {
  const result = await pool.query<PropertyPhotoRecord>(
    `SELECT ${PHOTO_COLUMNS} FROM "property_photos" WHERE id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function deletePropertyPhoto(id: string): Promise<void> {
  await pool.query('DELETE FROM "property_photos" WHERE id = $1', [id]);
}
