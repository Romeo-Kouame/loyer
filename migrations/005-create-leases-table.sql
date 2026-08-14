-- Links a tenant to a property they're renting. A property can have multiple
-- apartments/tenants over time (numberOfApartments), so this is a proper
-- join table rather than a single tenantId column on properties.
CREATE TABLE IF NOT EXISTS "leases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "tenantId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" VARCHAR(50) NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CHECK ("status" IN ('active', 'ended'))
);

CREATE INDEX idx_leases_propertyId ON "leases"("propertyId");
CREATE INDEX idx_leases_tenantId ON "leases"("tenantId");

-- A tenant can't have two simultaneous active leases on the same property.
CREATE UNIQUE INDEX idx_leases_active_unique ON "leases"("propertyId", "tenantId")
  WHERE "status" = 'active';
