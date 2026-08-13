import bcrypt from 'bcryptjs';
import { pool } from '../config/database';

const DEV_PASSWORD_HASH_ROUNDS = 10;

async function upsertUser(params: {
  email: string;
  phone: string;
  name: string;
  password: string;
  role: 'landlord' | 'tenant' | 'admin';
}): Promise<string> {
  const existing = await pool.query('SELECT id FROM "users" WHERE email = $1', [params.email]);
  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const passwordHash = await bcrypt.hash(params.password, DEV_PASSWORD_HASH_ROUNDS);
  const result = await pool.query(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role, "kycStatus")
     VALUES ($1, $2, $3, $4, $5, 'verified')
     RETURNING id`,
    [params.email, params.phone, params.name, passwordHash, params.role]
  );
  return result.rows[0].id;
}

async function seed(): Promise<void> {
  const landlordId = await upsertUser({
    email: 'landlord@example.com',
    phone: '+2250700000001',
    name: 'Landlord Demo',
    password: 'password123',
    role: 'landlord',
  });

  const tenantId = await upsertUser({
    email: 'tenant@example.com',
    phone: '+2250700000002',
    name: 'Tenant Demo',
    password: 'password123',
    role: 'tenant',
  });

  let propertyResult = await pool.query('SELECT id FROM "properties" WHERE "ownerId" = $1', [
    landlordId,
  ]);
  let propertyId: string;

  if (propertyResult.rows.length > 0) {
    propertyId = propertyResult.rows[0].id;
  } else {
    propertyResult = await pool.query(
      `INSERT INTO "properties" ("ownerId", address, "numberOfApartments")
       VALUES ($1, $2, $3)
       RETURNING id`,
      [landlordId, '12 Rue des Jardins, Abidjan', 4]
    );
    propertyId = propertyResult.rows[0].id;
  }

  const existingPayment = await pool.query(
    'SELECT id FROM "payments" WHERE "tenantId" = $1 AND "propertyId" = $2',
    [tenantId, propertyId]
  );

  if (existingPayment.rows.length === 0) {
    await pool.query(
      `INSERT INTO "payments" ("tenantId", "propertyId", amount, provider, "transactionId", status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, propertyId, 150000, 'wave', 'DEV-SEED-TXN-001', 'confirmed']
    );
  }

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
