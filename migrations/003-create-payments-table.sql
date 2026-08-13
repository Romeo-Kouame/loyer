-- Create payments table
CREATE TABLE IF NOT EXISTS "payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "propertyId" UUID NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "amount" DECIMAL(12, 2) NOT NULL,
  "provider" VARCHAR(50) NOT NULL,
  "transactionId" VARCHAR(255) UNIQUE,
  "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "paymentProof" VARCHAR(500),
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "webhookReceivedAt" TIMESTAMP,
  
  CHECK ("provider" IN ('wave', 'orange', 'mtn')),
  CHECK ("status" IN ('pending', 'confirmed', 'failed', 'disputed')),
  CHECK ("amount" > 0)
);

CREATE INDEX idx_payments_tenantId ON "payments"("tenantId");
CREATE INDEX idx_payments_propertyId ON "payments"("propertyId");
CREATE INDEX idx_payments_status ON "payments"("status");
CREATE INDEX idx_payments_createdAt ON "payments"("createdAt");
CREATE INDEX idx_payments_transactionId ON "payments"("transactionId");
