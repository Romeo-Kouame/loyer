import { pool } from '../config/database';

export type KycStatus = 'pending' | 'verified' | 'rejected';
export type PayoutProvider = 'mtn' | 'orange';

export type IdDocumentType = 'cni' | 'passport';

export interface UserRecord {
  id: string;
  email: string;
  phone: string;
  name: string;
  passwordHash: string;
  role: 'landlord' | 'tenant' | 'admin';
  kycStatus: KycStatus;
  kycDocumentPath: string | null;
  kycDocumentMimeType: string | null;
  kycSubmittedAt: Date | null;
  kycReviewedAt: Date | null;
  kycRejectionReason: string | null;
  payoutProvider: PayoutProvider | null;
  payoutPhoneNumber: string | null;
  emailRemindersEnabled: boolean;
  profilePicturePath: string | null;
  profilePictureMimeType: string | null;
  firstName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  idDocumentType: IdDocumentType | null;
  idDocumentNumber: string | null;
  activitySector: string | null;
  profession: string | null;
  secondPhone: string | null;
  currentAddress: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

const USER_COLUMNS = `id, email, phone, name, "passwordHash", role, "kycStatus",
  "kycDocumentPath", "kycDocumentMimeType", "kycSubmittedAt", "kycReviewedAt", "kycRejectionReason",
  "payoutProvider", "payoutPhoneNumber", "emailRemindersEnabled", "profilePicturePath", "profilePictureMimeType",
  "firstName", "lastName", "dateOfBirth", "placeOfBirth", "nationality", "idDocumentType", "idDocumentNumber",
  "activitySector", "profession", "secondPhone", "currentAddress", "emergencyContactName", "emergencyContactPhone"`;

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM "users" WHERE email = $1 AND "deletedAt" IS NULL`,
    [email]
  );
  return result.rows[0] ?? null;
}

export async function findUserByPhone(phone: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM "users" WHERE phone = $1 AND "deletedAt" IS NULL`,
    [phone]
  );
  return result.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM "users" WHERE id = $1 AND "deletedAt" IS NULL`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createUser(params: {
  email: string;
  phone: string;
  name: string;
  passwordHash: string;
  role: 'landlord' | 'tenant';
}): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${USER_COLUMNS}`,
    [params.email, params.phone, params.name, params.passwordHash, params.role]
  );
  return result.rows[0];
}

export async function submitKycDocument(
  userId: string,
  params: { documentPath: string; documentMimeType: string }
): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `UPDATE "users"
     SET "kycStatus" = 'pending',
         "kycDocumentPath" = $2,
         "kycDocumentMimeType" = $3,
         "kycSubmittedAt" = CURRENT_TIMESTAMP,
         "kycReviewedAt" = NULL,
         "kycRejectionReason" = NULL
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, params.documentPath, params.documentMimeType]
  );
  return result.rows[0];
}

export async function reviewKyc(
  userId: string,
  params: { status: 'verified' | 'rejected'; rejectionReason?: string | null }
): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `UPDATE "users"
     SET "kycStatus" = $2, "kycReviewedAt" = CURRENT_TIMESTAMP, "kycRejectionReason" = $3
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, params.status, params.rejectionReason ?? null]
  );
  return result.rows[0];
}

export async function updatePayoutDestination(
  userId: string,
  params: { payoutProvider: PayoutProvider; payoutPhoneNumber: string }
): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `UPDATE "users"
     SET "payoutProvider" = $2, "payoutPhoneNumber" = $3
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, params.payoutProvider, params.payoutPhoneNumber]
  );
  return result.rows[0];
}

export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await pool.query(
    `UPDATE "users"
     SET "passwordHash" = $2 WHERE id = $1`,
    [userId, passwordHash]
  );
}

export interface UpdateProfileParams {
  name?: string;
  phone?: string;
  emailRemindersEnabled?: boolean;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  nationality?: string;
  idDocumentType?: IdDocumentType;
  idDocumentNumber?: string;
  activitySector?: string;
  profession?: string;
  secondPhone?: string;
  currentAddress?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export async function updateProfile(userId: string, params: UpdateProfileParams): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `UPDATE "users"
     SET name = COALESCE($2, name),
         phone = COALESCE($3, phone),
         "emailRemindersEnabled" = COALESCE($4, "emailRemindersEnabled"),
         "firstName" = COALESCE($5, "firstName"),
         "lastName" = COALESCE($6, "lastName"),
         "dateOfBirth" = COALESCE($7, "dateOfBirth")::date,
         "placeOfBirth" = COALESCE($8, "placeOfBirth"),
         "nationality" = COALESCE($9, "nationality"),
         "idDocumentType" = COALESCE($10, "idDocumentType"),
         "idDocumentNumber" = COALESCE($11, "idDocumentNumber"),
         "activitySector" = COALESCE($12, "activitySector"),
         "profession" = COALESCE($13, "profession"),
         "secondPhone" = COALESCE($14, "secondPhone"),
         "currentAddress" = COALESCE($15, "currentAddress"),
         "emergencyContactName" = COALESCE($16, "emergencyContactName"),
         "emergencyContactPhone" = COALESCE($17, "emergencyContactPhone")
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [
      userId,
      params.name ?? null,
      params.phone ?? null,
      params.emailRemindersEnabled ?? null,
      params.firstName ?? null,
      params.lastName ?? null,
      params.dateOfBirth ?? null,
      params.placeOfBirth ?? null,
      params.nationality ?? null,
      params.idDocumentType ?? null,
      params.idDocumentNumber ?? null,
      params.activitySector ?? null,
      params.profession ?? null,
      params.secondPhone ?? null,
      params.currentAddress ?? null,
      params.emergencyContactName ?? null,
      params.emergencyContactPhone ?? null,
    ]
  );
  return result.rows[0];
}

export async function updateProfilePicture(
  userId: string,
  params: { path: string; mimeType: string }
): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `UPDATE "users"
     SET "profilePicturePath" = $2, "profilePictureMimeType" = $3
     WHERE id = $1
     RETURNING ${USER_COLUMNS}`,
    [userId, params.path, params.mimeType]
  );
  return result.rows[0];
}

export async function listUsersByKycStatus(params: {
  status?: KycStatus;
  limit: number;
  offset: number;
}): Promise<{ users: UserRecord[]; total: number }> {
  const conditions = ['"deletedAt" IS NULL'];
  const values: unknown[] = [];

  if (params.status) {
    values.push(params.status);
    conditions.push(`"kycStatus" = $${values.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM "users" ${whereClause}`,
    values
  );

  values.push(params.limit);
  values.push(params.offset);

  const usersResult = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS} FROM "users" ${whereClause}
     ORDER BY "kycSubmittedAt" ASC NULLS LAST
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { users: usersResult.rows, total: Number(countResult.rows[0].count) };
}
