-- CreateTable
CREATE TABLE "LineRoomBinding" (
    "id" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineRoomBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LineRoomBinding_lineUserId_key" ON "LineRoomBinding"("lineUserId");

-- CreateIndex
CREATE INDEX "LineRoomBinding_roomNumber_idx" ON "LineRoomBinding"("roomNumber");
