-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_key_route_key" ON "IdempotencyRecord"("key", "route");

-- CreateIndex
CREATE INDEX "BillingVersion_roomNumber_billingMonthId_isActive_idx" ON "BillingVersion"("roomNumber", "billingMonthId", "isActive");
