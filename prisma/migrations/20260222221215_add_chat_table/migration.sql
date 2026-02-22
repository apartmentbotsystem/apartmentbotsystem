-- CreateTable
CREATE TABLE "chat" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "external_message_id" TEXT,

    CONSTRAINT "chat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_external_message_id_key" ON "chat"("external_message_id");

-- CreateIndex
CREATE INDEX "chat_conversation_id_idx" ON "chat"("conversation_id");

-- CreateIndex
CREATE INDEX "chat_created_at_idx" ON "chat"("created_at" DESC);
