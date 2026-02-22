/*
  Warnings:

  - A unique constraint covering the columns `[roomNumber,billingMonthId,templateGroupId]` on the table `DocumentVersion` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('BILLING', 'RECEIPT', 'NOTICE', 'OTHER');

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "isZeroAmount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "snapshotJson" JSONB,
ADD COLUMN     "templateGroupId" TEXT,
ADD COLUMN     "templateVersion" INTEGER;

-- CreateTable
CREATE TABLE "TemplateGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "contentJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Template_groupId_version_key" ON "Template"("groupId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentVersion_roomNumber_billingMonthId_templateGroupId_key" ON "DocumentVersion"("roomNumber", "billingMonthId", "templateGroupId");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "TemplateGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
