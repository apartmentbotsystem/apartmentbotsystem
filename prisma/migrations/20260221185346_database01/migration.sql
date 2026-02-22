/*
  Warnings:

  - You are about to drop the column `roomId` on the `BillingRecord` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `DocumentVersion` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `OccupancyEvent` table. All the data in the column will be lost.
  - The primary key for the `Room` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Room` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `Ticket` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[roomNumber,billingMonthId]` on the table `BillingRecord` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `roomNumber` to the `BillingRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomNumber` to the `Contract` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomNumber` to the `DocumentVersion` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomNumber` to the `OccupancyEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roomNumber` to the `Ticket` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "BillingRecord" DROP CONSTRAINT "BillingRecord_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_roomId_fkey";

-- DropForeignKey
ALTER TABLE "DocumentVersion" DROP CONSTRAINT "DocumentVersion_roomId_fkey";

-- DropForeignKey
ALTER TABLE "OccupancyEvent" DROP CONSTRAINT "OccupancyEvent_roomId_fkey";

-- DropForeignKey
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_roomId_fkey";

-- DropIndex
DROP INDEX "Room_number_key";

-- AlterTable
ALTER TABLE "BillingRecord" DROP COLUMN "roomId",
ADD COLUMN     "roomNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "roomId",
ADD COLUMN     "roomNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DocumentVersion" DROP COLUMN "roomId",
ADD COLUMN     "roomNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "OccupancyEvent" DROP COLUMN "roomId",
ADD COLUMN     "roomNumber" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Room" DROP CONSTRAINT "Room_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Room_pkey" PRIMARY KEY ("number");

-- AlterTable
ALTER TABLE "Ticket" DROP COLUMN "roomId",
ADD COLUMN     "roomNumber" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BillingRecord_roomNumber_billingMonthId_key" ON "BillingRecord"("roomNumber", "billingMonthId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancyEvent" ADD CONSTRAINT "OccupancyEvent_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRecord" ADD CONSTRAINT "BillingRecord_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE RESTRICT ON UPDATE CASCADE;
