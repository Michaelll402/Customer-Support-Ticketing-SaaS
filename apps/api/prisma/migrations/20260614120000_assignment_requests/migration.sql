-- CreateEnum
CREATE TYPE "AssignmentRequestType" AS ENUM ('REASSIGN_USER', 'RETURN_TO_QUEUE');

-- CreateEnum
CREATE TYPE "AssignmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_REQUEST_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_REQUEST_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'ASSIGNMENT_REQUEST_REJECTED';

-- CreateTable
CREATE TABLE "AssignmentRequest" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "requestedAssigneeId" UUID,
    "type" "AssignmentRequestType" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AssignmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentRequest_ticketId_status_idx" ON "AssignmentRequest"("ticketId", "status");

-- CreateIndex
CREATE INDEX "AssignmentRequest_requestedById_status_idx" ON "AssignmentRequest"("requestedById", "status");

-- CreateIndex
CREATE INDEX "AssignmentRequest_status_createdAt_idx" ON "AssignmentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AssignmentRequest_requestedAssigneeId_idx" ON "AssignmentRequest"("requestedAssigneeId");

-- AddForeignKey
ALTER TABLE "AssignmentRequest" ADD CONSTRAINT "AssignmentRequest_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRequest" ADD CONSTRAINT "AssignmentRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRequest" ADD CONSTRAINT "AssignmentRequest_requestedAssigneeId_fkey" FOREIGN KEY ("requestedAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentRequest" ADD CONSTRAINT "AssignmentRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
