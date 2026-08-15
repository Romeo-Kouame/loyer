CREATE TABLE IF NOT EXISTS "maintenance_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "leaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE CASCADE,
  "reportedBy" UUID NOT NULL REFERENCES "users"("id"),
  "issueType" VARCHAR(100) NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "severity" VARCHAR(20) NOT NULL DEFAULT 'medium',
  "photoPath" VARCHAR(500),
  "photoMimeType" VARCHAR(100),
  "status" VARCHAR(20) NOT NULL DEFAULT 'open',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP,

  CHECK ("severity" IN ('low', 'medium', 'high', 'urgent')),
  CHECK ("status" IN ('open', 'in_progress', 'resolved', 'closed'))
);

CREATE INDEX idx_maintenance_requests_property ON "maintenance_requests"("propertyId");
CREATE INDEX idx_maintenance_requests_status ON "maintenance_requests"("status");

-- Lease-scoped conversation between a tenant and their landlord.
CREATE TABLE IF NOT EXISTS "messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "leaseId" UUID NOT NULL REFERENCES "leases"("id") ON DELETE CASCADE,
  "senderId" UUID NOT NULL REFERENCES "users"("id"),
  "body" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP
);

CREATE INDEX idx_messages_lease ON "messages"("leaseId");
