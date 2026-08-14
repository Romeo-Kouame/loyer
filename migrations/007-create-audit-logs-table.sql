-- Business-action audit trail: who did what, when. Distinct from web/product
-- analytics (visitor counts, page views), which belongs in a dedicated tool
-- (e.g. self-hosted Umami on the frontend), not this table.
CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "action" VARCHAR(100) NOT NULL,
  "resourceType" VARCHAR(50),
  "resourceId" UUID,
  "metadata" JSONB,
  "ipAddress" VARCHAR(45),
  "userAgent" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_userId ON "audit_logs"("userId");
CREATE INDEX idx_audit_logs_action ON "audit_logs"("action");
CREATE INDEX idx_audit_logs_createdAt ON "audit_logs"("createdAt");
