-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "ProfileRole" AS ENUM ('user', 'super_admin');

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "ProfileStatus" NOT NULL DEFAULT 'pending',
    "role" "ProfileRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE INDEX "Profile_status_idx" ON "Profile"("status");
