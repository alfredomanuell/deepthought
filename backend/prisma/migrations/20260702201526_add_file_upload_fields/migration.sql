-- AlterEnum
ALTER TYPE "ResourceType" ADD VALUE 'FILE';

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "originalName" TEXT;
