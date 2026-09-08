-- Lets a tenant generate a shareable link exposing a public, read-only
-- summary of their rental reputation (score, grade, payment history) to a
-- prospective landlord who isn't yet a user of the platform. The token is
-- opaque and revocable so the tenant controls who can see it and for how
-- long.
CREATE TABLE IF NOT EXISTS "tenant_passport_tokens" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" VARCHAR(64) NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP
);

CREATE INDEX idx_tenant_passport_tokens_tenantId ON "tenant_passport_tokens"("tenantId");
