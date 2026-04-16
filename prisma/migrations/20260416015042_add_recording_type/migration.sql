-- CreateEnum
CREATE TYPE "RecordingType" AS ENUM ('underline', 'whisper');

-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "type" "RecordingType" NOT NULL DEFAULT 'underline';
