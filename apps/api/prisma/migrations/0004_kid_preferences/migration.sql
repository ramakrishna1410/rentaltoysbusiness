-- CreateEnum
CREATE TYPE "PlayPlace" AS ENUM ('INDOOR', 'OUTDOOR', 'BOTH');

-- CreateEnum
CREATE TYPE "ParentGoal" AS ENUM ('LEARNING', 'FUN', 'SCREEN_FREE', 'MOTOR_SKILLS', 'SOCIAL');

-- AlterTable
ALTER TABLE "KidProfile" ADD COLUMN     "favoriteColors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "goals" "ParentGoal"[],
ADD COLUMN     "playPlace" "PlayPlace";

