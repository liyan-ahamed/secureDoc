CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "DriveType" AS ENUM ('PERSONAL', 'ORG');

CREATE TABLE "join_requests" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "respondedById" TEXT,
  CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "join_requests_orgId_userId_key" ON "join_requests"("orgId", "userId");
CREATE INDEX "join_requests_orgId_status_requestedAt_idx" ON "join_requests"("orgId", "status", "requestedAt");

ALTER TABLE "files" ADD COLUMN "driveType" "DriveType" NOT NULL DEFAULT 'PERSONAL';
CREATE INDEX "files_orgId_driveType_status_idx" ON "files"("orgId", "driveType", "status");
