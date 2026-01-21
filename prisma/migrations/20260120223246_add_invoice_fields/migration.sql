/*
  Warnings:

  - A unique constraint covering the columns `[lineUserId]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "accountSnapshot" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "data" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "furnitureAmount" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "note" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "otherAmount" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_lineUserId_key" ON "Tenant"("lineUserId");
