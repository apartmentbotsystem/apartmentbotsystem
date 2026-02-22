-- CreateTable
CREATE TABLE "BillingVersion" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "billingMonthId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "snapshotData" JSONB NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revertedFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "tenantId" TEXT,

    CONSTRAINT "BillingVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialFlag" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "billingMonthId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "difference" DECIMAL(12,2) NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT,

    CONSTRAINT "FinancialFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillingVersion_roomNumber_billingMonthId_idx" ON "BillingVersion"("roomNumber", "billingMonthId");

-- CreateIndex
CREATE INDEX "BillingVersion_isActive_idx" ON "BillingVersion"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BillingVersion_roomNumber_billingMonthId_versionNo_key" ON "BillingVersion"("roomNumber", "billingMonthId", "versionNo");
