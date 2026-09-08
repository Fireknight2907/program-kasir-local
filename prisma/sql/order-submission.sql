-- Additive only. Does not change existing restaurant records.
CREATE TABLE IF NOT EXISTS "OrderSubmission" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "response" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderSubmission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrderSubmission_transactionId_requestId_key" ON "OrderSubmission"("transactionId", "requestId");
CREATE INDEX IF NOT EXISTS "OrderSubmission_transactionId_createdAt_idx" ON "OrderSubmission"("transactionId", "createdAt");
