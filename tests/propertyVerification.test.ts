import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';
import { config } from '../src/config/environment';

const uniqueSuffix = Date.now();
const landlord = {
  email: `pv-landlord-${uniqueSuffix}@example.com`,
  phone: `+225097100${uniqueSuffix.toString().slice(-4)}`,
  name: 'PV Landlord',
  password: 'password123',
  role: 'landlord',
};
const otherLandlord = {
  email: `pv-other-${uniqueSuffix}@example.com`,
  phone: `+225098100${uniqueSuffix.toString().slice(-4)}`,
  name: 'PV Other',
  password: 'password123',
  role: 'landlord',
};

const fakeDoc = Buffer.from('fake-title-deed');

let landlordToken: string;
let otherLandlordToken: string;
let adminToken: string;
let propertyId: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const otherRes = await request(app).post('/api/v1/auth/register').send(otherLandlord);
  otherLandlordToken = otherRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'PV Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  const adminResult = await pool.query(
    `INSERT INTO "users" (email, phone, name, "passwordHash", role)
     VALUES ($1, $2, $3, 'x', 'admin')
     RETURNING id`,
    [`pv-admin-${uniqueSuffix}@example.com`, `+225099100${uniqueSuffix.toString().slice(-4)}`, 'PV Admin']
  );
  adminToken = jwt.sign(
    { userId: adminResult.rows[0].id, email: 'admin', role: 'admin' },
    config.jwt.secret,
    { expiresIn: '15m' }
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [
    landlord.email,
    otherLandlord.email,
    `pv-admin-${uniqueSuffix}@example.com`,
  ]);
  await pool.end();
});

describe('POST /api/v1/properties/:id/verification', () => {
  it('lets the owner submit a verification document', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/verification`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .attach('document', fakeDoc, { filename: 'title.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(200);
    expect(response.body.data.verificationStatus).toBe('pending_review');
  });

  it('rejects a landlord who does not own the property', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/verification`)
      .set('Authorization', `Bearer ${otherLandlordToken}`)
      .attach('document', fakeDoc, { filename: 'title.pdf', contentType: 'application/pdf' });

    expect(response.status).toBe(403);
  });
});

describe('GET /api/v1/properties/:id/verification/document', () => {
  it('forbids a non-owner from viewing the document', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/verification/document`)
      .set('Authorization', `Bearer ${otherLandlordToken}`);

    expect(response.status).toBe(403);
  });

  it('lets the owner view it', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/verification/document`)
      .set('Authorization', `Bearer ${landlordToken}`);

    expect(response.status).toBe(200);
  });
});

describe('Admin property verification review', () => {
  it('rejects non-admins', async () => {
    const response = await request(app)
      .get('/api/v1/admin/property-verifications')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(403);
  });

  it('lists pending verifications', async () => {
    const response = await request(app)
      .get('/api/v1/admin/property-verifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.data.properties.map((p: { id: string }) => p.id);
    expect(ids).toContain(propertyId);
  });

  it('approves the verification', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/property-verifications/${propertyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });

    expect(response.status).toBe(200);
    expect(response.body.data.verificationStatus).toBe('verified');
  });

  it('rejects reviewing it again', async () => {
    const response = await request(app)
      .patch(`/api/v1/admin/property-verifications/${propertyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'verified' });

    expect(response.status).toBe(409);
  });
});
