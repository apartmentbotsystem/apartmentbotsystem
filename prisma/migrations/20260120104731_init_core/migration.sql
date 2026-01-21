-- CreateTable
CREATE TABLE "LineRegistration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lineUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "requestedRoomNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "approvedBy" TEXT,
    "tenantId" TEXT,
    CONSTRAINT "LineRegistration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LineRegistration_lineUserId_key" ON "LineRegistration"("lineUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LineRegistration_tenantId_key" ON "LineRegistration"("tenantId");
