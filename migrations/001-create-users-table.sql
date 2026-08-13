-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "phone" VARCHAR(20) NOT NULL UNIQUE,
  "name" VARCHAR(255) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "role" VARCHAR(50) NOT NULL DEFAULT 'tenant',
  "kycStatus" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "amlRiskScore" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP,
  
  CHECK ("role" IN ('landlord', 'tenant', 'admin')),
  CHECK ("kycStatus" IN ('pending', 'verified', 'rejected'))
);

CREATE INDEX idx_users_email ON "users"("email");
CREATE INDEX idx_users_phone ON "users"("phone");
CREATE INDEX idx_users_role ON "users"("role");
