-- AlterTable
ALTER TABLE "RegistrationRequest" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "LineConversationState" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "tempRoom" TEXT,
    "tempName" TEXT,
    "tempPhone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineConversationState_lineUserId_key" ON "LineConversationState"("lineUserId");
