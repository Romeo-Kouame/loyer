import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `maint-landlord-${uniqueSuffix}@example.com`,
  phone: `+225078000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Maintenance Landlord',
  password: 'password123',
  role: 'landlord',
};
const otherLandlord = {
  email: `maint-other-landlord-${uniqueSuffix}@example.com`,
  phone: `+225079000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `maint-tenant-${uniqueSuffix}@example.com`,
  phone: `+225080000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Maintenance Tenant',
  password: 'password123',
  role: 'tenant',
};
const otherTenant = {
  email: `maint-other-tenant-${uniqueSuffix}@example.com`,
  phone: `+225081000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let otherLandlordToken: string;
let tenantToken: string;
let otherTenantToken: string;
let propertyId: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const otherLandlordRes = await request(app).post('/api/v1/auth/register').send(otherLandlord);
  otherLandlordToken = otherLandlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const otherTenantRes = await request(app).post('/api/v1/auth/register').send(otherTenant);
  otherTenantToken = otherTenantRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Maintenance Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      unitLabel: 'A1',
      rentAmount: 75000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: true,
    });
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3, $4)', [
    landlord.email,
    otherLandlord.email,
    tenant.email,
    otherTenant.email,
  ]);
  await pool.end();
});

describe('POST /api/v1/tenant/maintenance', () => {
  it('rejects a tenant with no active lease on the property', async () => {
    const response = await request(app)
      .post('/api/v1/tenant/maintenance')
      .set('Authorization', `Bearer ${otherTenantToken}`)
      .field('propertyId', propertyId)
      .field('issueType', 'Plomberie')
      .field('description', 'Fuite sous l\'évier de la cuisine')
      .field('severity', 'medium');

    expect(response.status).toBe(403);
  });

  it('lets the leased tenant report an issue with a photo', async () => {
    const response = await request(app)
      .post('/api/v1/tenant/maintenance')
      .set('Authorization', `Bearer ${tenantToken}`)
      .field('propertyId', propertyId)
      .field('issueType', 'Plomberie')
      .field('description', 'Fuite sous l\'évier de la cuisine')
      .field('severity', 'high')
      .attach('photo', Buffer.from('fake-photo-bytes'), { filename: 'leak.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    expect(response.body.data.issueType).toBe('Plomberie');
    expect(response.body.data.severity).toBe('high');
  });
});

describe('Maintenance request listing and management', () => {
  let requestId: string;

  beforeAll(async () => {
    const listRes = await request(app).get('/api/v1/tenant/maintenance').set('Authorization', `Bearer ${tenantToken}`);
    requestId = listRes.body.data[0].id;
  });

  it('lists only the reporting tenant\'s own requests', async () => {
    const mine = await request(app).get('/api/v1/tenant/maintenance').set('Authorization', `Bearer ${tenantToken}`);
    expect(mine.status).toBe(200);
    expect(mine.body.data.some((r: { id: string }) => r.id === requestId)).toBe(true);

    const notMine = await request(app)
      .get('/api/v1/tenant/maintenance')
      .set('Authorization', `Bearer ${otherTenantToken}`);
    expect(notMine.body.data.some((r: { id: string }) => r.id === requestId)).toBe(false);
  });

  it('lists the request for the owning landlord, with a pending count', async () => {
    const listRes = await request(app)
      .get('/api/v1/landlord/maintenance')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((r: { id: string }) => r.id === requestId)).toBe(true);

    const countRes = await request(app)
      .get('/api/v1/landlord/maintenance/pending-count')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(countRes.body.data.count).toBeGreaterThanOrEqual(1);
  });

  it('rejects a landlord who does not own the property from managing it', async () => {
    const response = await request(app)
      .patch(`/api/v1/landlord/maintenance/${requestId}`)
      .set('Authorization', `Bearer ${otherLandlordToken}`)
      .send({ status: 'in_progress' });
    expect(response.status).toBe(403);
  });

  it('lets the owning landlord update status and severity', async () => {
    const statusRes = await request(app)
      .patch(`/api/v1/landlord/maintenance/${requestId}`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ status: 'in_progress' });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('in_progress');

    const severityRes = await request(app)
      .patch(`/api/v1/landlord/maintenance/${requestId}/severity`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ severity: 'urgent' });
    expect(severityRes.status).toBe(200);
    expect(severityRes.body.data.severity).toBe('urgent');
  });

  it('creates an in-app notification for the landlord when the issue is reported', async () => {
    const response = await request(app)
      .get('/api/v1/landlord/notifications')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data.some((n: { type: string }) => n.type === 'maintenance_reported')).toBe(true);
  });

  describe('comments and photo access control', () => {
    it('forbids an unrelated tenant from viewing or commenting', async () => {
      const getRes = await request(app)
        .get(`/api/v1/maintenance/${requestId}/comments`)
        .set('Authorization', `Bearer ${otherTenantToken}`);
      expect(getRes.status).toBe(403);

      const postRes = await request(app)
        .post(`/api/v1/maintenance/${requestId}/comments`)
        .set('Authorization', `Bearer ${otherTenantToken}`)
        .send({ body: 'Trying to comment on a request that is not mine' });
      expect(postRes.status).toBe(403);

      const photoRes = await request(app)
        .get(`/api/v1/maintenance/${requestId}/photo`)
        .set('Authorization', `Bearer ${otherTenantToken}`);
      expect(photoRes.status).toBe(403);
    });

    it('lets the reporting tenant and the owning landlord exchange comments', async () => {
      const tenantComment = await request(app)
        .post(`/api/v1/maintenance/${requestId}/comments`)
        .set('Authorization', `Bearer ${tenantToken}`)
        .send({ body: 'Toujours en cours, merci de venir cette semaine' });
      expect(tenantComment.status).toBe(201);
      expect(tenantComment.body.data).toHaveLength(1);

      const landlordComment = await request(app)
        .post(`/api/v1/maintenance/${requestId}/comments`)
        .set('Authorization', `Bearer ${landlordToken}`)
        .send({ body: 'Un plombier passera demain matin' });
      expect(landlordComment.status).toBe(201);
      expect(landlordComment.body.data).toHaveLength(2);

      const listRes = await request(app)
        .get(`/api/v1/maintenance/${requestId}/comments`)
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(2);
    });

    it('lets the reporter and the owning landlord view the attached photo', async () => {
      const asTenant = await request(app)
        .get(`/api/v1/maintenance/${requestId}/photo`)
        .set('Authorization', `Bearer ${tenantToken}`);
      expect(asTenant.status).toBe(200);

      const asLandlord = await request(app)
        .get(`/api/v1/maintenance/${requestId}/photo`)
        .set('Authorization', `Bearer ${landlordToken}`);
      expect(asLandlord.status).toBe(200);
    });
  });
});
