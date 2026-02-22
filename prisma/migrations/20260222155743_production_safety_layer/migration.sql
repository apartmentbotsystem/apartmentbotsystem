-- CreateTable
CREATE TABLE "message_delivery_log" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "lineUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_delivery_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_audit_log" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB NOT NULL,
    "afterData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_delivery_log_referenceId_key" ON "message_delivery_log"("referenceId");
