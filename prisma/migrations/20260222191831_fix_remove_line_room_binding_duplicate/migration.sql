/*
  Warnings:

  - You are about to drop the column `approved` on the `LineBinding` table. All the data in the column will be lost.
  - You are about to drop the column `approvedAt` on the `LineBinding` table. All the data in the column will be lost.
  - You are about to drop the column `residentId` on the `LineBinding` table. All the data in the column will be lost.
  - You are about to drop the column `tenantId` on the `LineBinding` table. All the data in the column will be lost.
  - You are about to drop the `LineRoomBinding` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `roomNumber` to the `LineBinding` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "LineBinding" DROP CONSTRAINT "LineBinding_residentId_fkey";

-- DropIndex
DROP INDEX "LineBinding_residentId_key";

-- AlterTable
ALTER TABLE "LineBinding" DROP COLUMN "approved",
DROP COLUMN "approvedAt",
DROP COLUMN "residentId",
DROP COLUMN "tenantId",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "roomNumber" TEXT NOT NULL;

-- DropTable
DROP TABLE "LineRoomBinding";

-- CreateIndex
CREATE INDEX "LineBinding_roomNumber_idx" ON "LineBinding"("roomNumber");
