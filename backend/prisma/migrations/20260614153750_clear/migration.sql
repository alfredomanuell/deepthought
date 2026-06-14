/*
  Warnings:

  - You are about to drop the `EmailOtp` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OTPCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RefreshToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RefreshToken" DROP CONSTRAINT "RefreshToken_userId_fkey";

-- DropTable
DROP TABLE "EmailOtp";

-- DropTable
DROP TABLE "OTPCode";

-- DropTable
DROP TABLE "RefreshToken";

-- DropTable
DROP TABLE "user";
