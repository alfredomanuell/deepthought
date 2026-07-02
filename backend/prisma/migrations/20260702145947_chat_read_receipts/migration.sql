-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'NEW_MESSAGE';

-- AlterTable
ALTER TABLE "ChatRoomParticipant" ADD COLUMN     "lastReadAt" TIMESTAMP(3);
