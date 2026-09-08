CREATE TABLE IF NOT EXISTS "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "body" VARCHAR(500),
  "propertyId" UUID REFERENCES "properties"("id") ON DELETE SET NULL,
  "readAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_created ON "notifications"("userId", "createdAt" DESC);
CREATE INDEX idx_notifications_user_unread ON "notifications"("userId", "readAt");
