-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BillingFieldMapping" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BillingMonth" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "BillingRecord" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ConversationMessage" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "DocumentSendLog" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Floor" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LineBinding" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LineMessage" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "MoveHistory" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "PaymentMatch" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Resident" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "RoomResident" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "TicketMessage" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_key" ON "UserRole"("userId", "roleId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
