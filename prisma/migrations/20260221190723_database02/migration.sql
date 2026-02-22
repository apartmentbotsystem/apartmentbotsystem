/*
  Warnings:

  - You are about to drop the `OccupancyEvent` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "OccupancyEvent" DROP CONSTRAINT "OccupancyEvent_residentId_fkey";

-- DropForeignKey
ALTER TABLE "OccupancyEvent" DROP CONSTRAINT "OccupancyEvent_roomNumber_fkey";

-- DropTable
DROP TABLE "OccupancyEvent";

-- CreateTable
CREATE TABLE "MoveHistory" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "residentId" TEXT,
    "type" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoveHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomResident" (
    "id" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "residentId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'SECONDARY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "RoomResident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "residentId" TEXT,
    "roomNumber" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billingRecordId" TEXT,
    "ticketId" TEXT,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomResident_roomNumber_idx" ON "RoomResident"("roomNumber");

-- CreateIndex
CREATE INDEX "RoomResident_residentId_idx" ON "RoomResident"("residentId");

-- CreateIndex
CREATE INDEX "Conversation_roomNumber_idx" ON "Conversation"("roomNumber");

-- CreateIndex
CREATE INDEX "Conversation_residentId_idx" ON "Conversation"("residentId");

-- AddForeignKey
ALTER TABLE "MoveHistory" ADD CONSTRAINT "MoveHistory_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoveHistory" ADD CONSTRAINT "MoveHistory_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomResident" ADD CONSTRAINT "RoomResident_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomResident" ADD CONSTRAINT "RoomResident_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_residentId_fkey" FOREIGN KEY ("residentId") REFERENCES "Resident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_roomNumber_fkey" FOREIGN KEY ("roomNumber") REFERENCES "Room"("number") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
