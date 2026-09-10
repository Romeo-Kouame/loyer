import request from 'supertest';
import app from '../src/app';
import { pool } from '../src/config/database';

const uniqueSuffix = Date.now();
const landlord = {
  email: `msg-landlord-${uniqueSuffix}@example.com`,
  phone: `+225082000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Message Landlord',
  password: 'password123',
  role: 'landlord',
};
const tenant = {
  email: `msg-tenant-${uniqueSuffix}@example.com`,
  phone: `+225083000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Message Tenant',
  password: 'password123',
  role: 'tenant',
};
const otherTenant = {
  email: `msg-other-tenant-${uniqueSuffix}@example.com`,
  phone: `+225084000${uniqueSuffix.toString().slice(-4)}`,
  name: 'Other Message Tenant',
  password: 'password123',
  role: 'tenant',
};

let landlordToken: string;
let tenantToken: string;
let otherTenantToken: string;
let propertyId: string;
let leaseId: string;

beforeAll(async () => {
  const landlordRes = await request(app).post('/api/v1/auth/register').send(landlord);
  landlordToken = landlordRes.body.data.tokens.accessToken;

  const tenantRes = await request(app).post('/api/v1/auth/register').send(tenant);
  tenantToken = tenantRes.body.data.tokens.accessToken;

  const otherTenantRes = await request(app).post('/api/v1/auth/register').send(otherTenant);
  otherTenantToken = otherTenantRes.body.data.tokens.accessToken;

  const propertyRes = await request(app)
    .post('/api/v1/properties')
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({ address: 'Messages Test Property, Abidjan', numberOfApartments: 1 });
  propertyId = propertyRes.body.data.id;

  const leaseRes = await request(app)
    .post(`/api/v1/properties/${propertyId}/leases`)
    .set('Authorization', `Bearer ${landlordToken}`)
    .send({
      tenantEmail: tenant.email,
      unitLabel: 'A1',
      rentAmount: 60000,
      moveInDate: new Date().toISOString().slice(0, 10),
      installmentsAllowed: true,
    });
  leaseId = leaseRes.body.data.id;
});

afterAll(async () => {
  await pool.query('DELETE FROM "properties" WHERE id = $1', [propertyId]);
  await pool.query('DELETE FROM "users" WHERE email IN ($1, $2, $3)', [landlord.email, tenant.email, otherTenant.email]);
  await pool.end();
});

describe('Per-lease messaging', () => {
  it('forbids a user who is not a party to the lease', async () => {
    const response = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${otherTenantToken}`);
    expect(response.status).toBe(403);
  });

  it('starts empty, then lets the tenant and landlord exchange messages', async () => {
    const empty = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(empty.status).toBe(200);
    expect(empty.body.data).toEqual([]);

    const fromTenant = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ body: 'Bonjour, le portail du parking est bloqué.' });
    expect(fromTenant.status).toBe(201);
    expect(fromTenant.body.data.body).toBe('Bonjour, le portail du parking est bloqué.');

    const fromLandlord = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${landlordToken}`)
      .send({ body: "J'envoie quelqu'un aujourd'hui." });
    expect(fromLandlord.status).toBe(201);

    const conversation = await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${tenantToken}`);
    expect(conversation.body.data).toHaveLength(2);
  });

  it('rejects an empty message body', async () => {
    const response = await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ body: '' });
    expect(response.status).toBe(400);
  });
});

describe('GET /api/v1/messages (conversation inbox)', () => {
  it('lists the conversation with an unread count for the landlord until read', async () => {
    await request(app)
      .post(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ body: 'Toujours pas résolu, une idée ?' });

    const inbox = await request(app).get('/api/v1/messages').set('Authorization', `Bearer ${landlordToken}`);
    expect(inbox.status).toBe(200);
    const conversation = inbox.body.data.find((c: { leaseId: string }) => c.leaseId === leaseId);
    expect(conversation).toBeDefined();
    expect(conversation.unreadCount).toBeGreaterThanOrEqual(1);
    expect(conversation.counterpartName).toBe(tenant.name);

    const unread = await request(app)
      .get('/api/v1/messages/unread-count')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(unread.body.data.count).toBeGreaterThanOrEqual(1);

    // Reading the conversation marks its messages as read for the landlord.
    await request(app)
      .get(`/api/v1/properties/${propertyId}/leases/${leaseId}/messages`)
      .set('Authorization', `Bearer ${landlordToken}`);

    const afterRead = await request(app)
      .get('/api/v1/messages/unread-count')
      .set('Authorization', `Bearer ${landlordToken}`);
    expect(afterRead.body.data.count).toBe(0);
  });
});
