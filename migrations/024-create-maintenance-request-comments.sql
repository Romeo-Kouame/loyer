-- A lightweight comment thread scoped to one maintenance request, so the
-- back-and-forth about a specific repair ("j'envoie quelqu'un demain",
-- "toujours pas réparé") doesn't get buried in the general lease chat.
CREATE TABLE IF NOT EXISTS "maintenance_request_comments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" UUID NOT NULL REFERENCES "maintenance_requests"("id") ON DELETE CASCADE,
  "authorId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_maintenance_request_comments_requestId ON "maintenance_request_comments"("requestId");
