-- AlterTable
ALTER TABLE "User" ADD COLUMN "characterCreated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "characterLayers" JSONB;
