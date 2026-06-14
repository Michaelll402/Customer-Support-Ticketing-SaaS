-- CreateEnum
CREATE TYPE "SlaPlanAppliesTo" AS ENUM ('ALL', 'PRIORITY', 'CATEGORY');

-- CreateEnum
CREATE TYPE "SlaTargetState" AS ENUM ('ON_TRACK', 'AT_RISK', 'BREACHED', 'MET');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TicketEventType" ADD VALUE 'SLA_AT_RISK';
ALTER TYPE "TicketEventType" ADD VALUE 'SLA_BREACHED';

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN     "firstResponseState" "SlaTargetState" NOT NULL DEFAULT 'ON_TRACK',
ADD COLUMN     "resolutionState" "SlaTargetState" NOT NULL DEFAULT 'ON_TRACK',
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "slaPlanId" UUID;

-- CreateTable
CREATE TABLE "SlaPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "firstResponseMinutes" INTEGER NOT NULL,
    "resolutionMinutes" INTEGER NOT NULL,
    "appliesTo" "SlaPlanAppliesTo" NOT NULL DEFAULT 'ALL',
    "priority" "TicketPriority",
    "categoryId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlaPlan_name_key" ON "SlaPlan"("name");

-- CreateIndex
CREATE INDEX "SlaPlan_appliesTo_isActive_idx" ON "SlaPlan"("appliesTo", "isActive");

-- CreateIndex
CREATE INDEX "SlaPlan_categoryId_idx" ON "SlaPlan"("categoryId");

-- CreateIndex
CREATE INDEX "SlaPlan_priority_idx" ON "SlaPlan"("priority");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Ticket_firstResponseState_firstResponseDueAt_idx" ON "Ticket"("firstResponseState", "firstResponseDueAt");

-- CreateIndex
CREATE INDEX "Ticket_resolutionState_resolutionDueAt_idx" ON "Ticket"("resolutionState", "resolutionDueAt");

-- CreateIndex
CREATE INDEX "Ticket_slaPlanId_idx" ON "Ticket"("slaPlanId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_slaPlanId_fkey" FOREIGN KEY ("slaPlanId") REFERENCES "SlaPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaPlan" ADD CONSTRAINT "SlaPlan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

