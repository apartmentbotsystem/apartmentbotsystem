/*
  Warnings:

  - A unique constraint covering the columns `[templateId,roomNumber,billingMonthId,versionNo]` on the table `DocumentVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('NORMAL', 'AIR');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'OVERDUE', 'TERMINATED', 'PAID');

-- AlterTable
ALTER TABLE "BillingMonth" ADD COLUMN     "dueDay" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "BillingRecord" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "overdueDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "penalty" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "BillingStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "type" "RoomType" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "BillingFieldMapping" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "targetKey" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "BillingFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_templateId_roomNumber_billingMonthId_versio_key" ON "DocumentVersion"("templateId", "roomNumber", "billingMonthId", "versionNo");
