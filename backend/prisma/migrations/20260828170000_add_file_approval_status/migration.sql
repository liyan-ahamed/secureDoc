CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "files"
ADD COLUMN "status" "FileStatus" NOT NULL DEFAULT 'APPROVED';

CREATE INDEX "files_orgId_status_idx" ON "files"("orgId", "status");
