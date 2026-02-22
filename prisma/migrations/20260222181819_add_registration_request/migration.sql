-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "residentName" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegistrationRequest_lineUserId_idx" ON "RegistrationRequest"("lineUserId");

-- CreateIndex
CREATE INDEX "RegistrationRequest_roomNumber_idx" ON "RegistrationRequest"("roomNumber");
