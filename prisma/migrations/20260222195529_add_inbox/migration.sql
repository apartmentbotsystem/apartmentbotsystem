/*
  Warnings:

  - A unique constraint covering the columns `[lineUserId]` on the table `Conversation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "lineUserId" TEXT,
ADD COLUMN     "unreadAdmin" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_lineUserId_key" ON "Conversation"("lineUserId");
