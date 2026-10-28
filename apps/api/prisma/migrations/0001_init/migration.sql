-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "Material" AS ENUM ('PLASTIC', 'WOODEN', 'FABRIC_PLUSH', 'METAL', 'SILICONE_RUBBER', 'MIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "PowerType" AS ENUM ('ELECTRIC', 'NON_ELECTRIC');

-- CreateEnum
CREATE TYPE "PieceType" AS ENUM ('SINGLE', 'MULTI');

-- CreateEnum
CREATE TYPE "SizeClass" AS ENUM ('STANDARD', 'LARGE');

-- CreateEnum
CREATE TYPE "Interest" AS ENUM ('ELECTRIC', 'EDUCATIONAL_STEM', 'WOODEN', 'SOFT_PLUSH', 'PRETEND_PLAY', 'PUZZLES', 'BUILDING_BLOCKS', 'OUTDOOR_RIDE_ON', 'MUSICAL', 'ARTS_CRAFTS');

-- CreateEnum
CREATE TYPE "ToyStage" AS ENUM ('PROCUREMENT', 'STORAGE', 'IN_TRANSIT', 'WITH_CUSTOMER', 'SANITATION', 'DAMAGE', 'SCRAP');

-- CreateEnum
CREATE TYPE "UnitCondition" AS ENUM ('NEW', 'GOOD', 'FAIR');

-- CreateEnum
CREATE TYPE "PieceStatus" AS ENUM ('PRESENT', 'MISSING', 'DAMAGED');

-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('FAST', 'MEDIUM', 'SLOW');

-- CreateEnum
CREATE TYPE "TierCode" AS ENUM ('BASIC', 'PRO', 'ULTRA');

-- CreateEnum
CREATE TYPE "DurationCode" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DELIVERY', 'SWAP');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('REQUESTED', 'DISPATCHED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('VIEW', 'WISHLIST', 'RENT', 'RATING');

-- CreateEnum
CREATE TYPE "OrderItemDirection" AS ENUM ('OUT', 'RETURN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "addressLine" TEXT,
    "area" TEXT,
    "pincode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KidProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "interests" "Interest"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KidProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Toy" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "images" TEXT[],
    "color" TEXT NOT NULL,
    "lengthCm" DOUBLE PRECISION NOT NULL,
    "breadthCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "manufacturingDate" TIMESTAMP(3) NOT NULL,
    "ageMinMonths" INTEGER NOT NULL,
    "ageMaxMonths" INTEGER NOT NULL,
    "material" "Material" NOT NULL,
    "powerType" "PowerType" NOT NULL,
    "batteryType" TEXT,
    "batteryCount" INTEGER,
    "pieceType" "PieceType" NOT NULL,
    "pieceCount" INTEGER NOT NULL DEFAULT 1,
    "interestTags" "Interest"[],
    "tags" TEXT[],
    "sizeClass" "SizeClass" NOT NULL,
    "mrp" INTEGER NOT NULL,
    "rentalCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Toy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrImage" (
    "id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "png" BYTEA NOT NULL,
    "svg" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToyUnit" (
    "id" TEXT NOT NULL,
    "toyId" TEXT NOT NULL,
    "vendor" TEXT,
    "procurementDate" TIMESTAMP(3) NOT NULL,
    "cost" INTEGER NOT NULL,
    "condition" "UnitCondition" NOT NULL DEFAULT 'NEW',
    "stage" "ToyStage" NOT NULL DEFAULT 'PROCUREMENT',
    "reservedForOrderId" TEXT,
    "binId" TEXT,
    "qrPayload" TEXT NOT NULL,
    "qrImageId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToyPiece" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "pieceNo" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "qrImageId" TEXT,
    "status" "PieceStatus" NOT NULL DEFAULT 'PRESENT',

    CONSTRAINT "ToyPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageMovement" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "fromStage" "ToyStage",
    "toStage" "ToyStage" NOT NULL,
    "scannedPayload" TEXT NOT NULL,
    "scannedById" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromBinId" TEXT,
    "toBinId" TEXT,
    "orderId" TEXT,
    "pieceScan" JSONB,
    "reason" TEXT,

    CONSTRAINT "StageMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ZoneType" NOT NULL,
    "distanceToDispatchM" INTEGER NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rack" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "Rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shelf" (
    "id" TEXT NOT NULL,
    "rackId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,

    CONSTRAINT "Shelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bin" (
    "id" TEXT NOT NULL,
    "shelfId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "lengthCm" DOUBLE PRECISION NOT NULL,
    "breadthCm" DOUBLE PRECISION NOT NULL,
    "heightCm" DOUBLE PRECISION NOT NULL,
    "maxWeightKg" DOUBLE PRECISION NOT NULL,
    "usedVolumeCm3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "usedWeightKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pickCost" DOUBLE PRECISION NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "qrImageId" TEXT,

    CONSTRAINT "Bin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanTier" (
    "code" "TierCode" NOT NULL,
    "name" TEXT NOT NULL,
    "toyCredits" INTEGER NOT NULL,
    "swapsPerMonth" INTEGER NOT NULL,
    "deliveriesPerMonth" INTEGER NOT NULL,
    "expressDelivery" BOOLEAN NOT NULL,
    "baseMonthlyPrice" INTEGER NOT NULL,

    CONSTRAINT "PlanTier_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "PlanDuration" (
    "code" "DurationCode" NOT NULL,
    "name" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "priceFactor" DOUBLE PRECISION NOT NULL,
    "swapRollover" BOOLEAN NOT NULL,
    "pauseDays" INTEGER NOT NULL,
    "buyoutDiscountPct" INTEGER NOT NULL,
    "extras" TEXT[],

    CONSTRAINT "PlanDuration_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "tierCode" "TierCode" NOT NULL,
    "durationCode" "DurationCode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "instalmentCount" INTEGER NOT NULL,
    "instalmentAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,

    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingCycle" "BillingCycle" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "commitmentStart" TIMESTAMP(3) NOT NULL,
    "commitmentEnd" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "swapsUsed" INTEGER NOT NULL DEFAULT 0,
    "deliveriesUsed" INTEGER NOT NULL DEFAULT 0,
    "rolloverSwaps" INTEGER NOT NULL DEFAULT 0,
    "creditsInUse" INTEGER NOT NULL DEFAULT 0,
    "missingPieceCharges" INTEGER NOT NULL DEFAULT 0,
    "pausedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "kidId" TEXT,
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "toyId" TEXT NOT NULL,
    "unitId" TEXT,
    "direction" "OrderItemDirection" NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kidId" TEXT,
    "toyId" TEXT NOT NULL,
    "type" "InteractionType" NOT NULL,
    "value" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Toy_sku_key" ON "Toy"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "QrImage_payload_key" ON "QrImage"("payload");

-- CreateIndex
CREATE UNIQUE INDEX "ToyUnit_qrPayload_key" ON "ToyUnit"("qrPayload");

-- CreateIndex
CREATE INDEX "ToyUnit_toyId_stage_idx" ON "ToyUnit"("toyId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "ToyPiece_qrPayload_key" ON "ToyPiece"("qrPayload");

-- CreateIndex
CREATE UNIQUE INDEX "ToyPiece_unitId_pieceNo_key" ON "ToyPiece"("unitId", "pieceNo");

-- CreateIndex
CREATE INDEX "StageMovement_unitId_scannedAt_idx" ON "StageMovement"("unitId", "scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "Zone"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Rack_code_key" ON "Rack"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Bin_code_key" ON "Bin"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Bin_qrPayload_key" ON "Bin"("qrPayload");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_tierCode_durationCode_key" ON "Plan"("tierCode", "durationCode");

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrice_planId_billingCycle_key" ON "PlanPrice"("planId", "billingCycle");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_subscriptionId_seq_key" ON "Invoice"("subscriptionId", "seq");

-- CreateIndex
CREATE INDEX "Interaction_kidId_createdAt_idx" ON "Interaction"("kidId", "createdAt");

-- AddForeignKey
ALTER TABLE "KidProfile" ADD CONSTRAINT "KidProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToyUnit" ADD CONSTRAINT "ToyUnit_toyId_fkey" FOREIGN KEY ("toyId") REFERENCES "Toy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToyUnit" ADD CONSTRAINT "ToyUnit_binId_fkey" FOREIGN KEY ("binId") REFERENCES "Bin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToyPiece" ADD CONSTRAINT "ToyPiece_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ToyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMovement" ADD CONSTRAINT "StageMovement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ToyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageMovement" ADD CONSTRAINT "StageMovement_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rack" ADD CONSTRAINT "Rack_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shelf" ADD CONSTRAINT "Shelf_rackId_fkey" FOREIGN KEY ("rackId") REFERENCES "Rack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bin" ADD CONSTRAINT "Bin_shelfId_fkey" FOREIGN KEY ("shelfId") REFERENCES "Shelf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_tierCode_fkey" FOREIGN KEY ("tierCode") REFERENCES "PlanTier"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_durationCode_fkey" FOREIGN KEY ("durationCode") REFERENCES "PlanDuration"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanPrice" ADD CONSTRAINT "PlanPrice_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_kidId_fkey" FOREIGN KEY ("kidId") REFERENCES "KidProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_toyId_fkey" FOREIGN KEY ("toyId") REFERENCES "Toy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ToyUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_kidId_fkey" FOREIGN KEY ("kidId") REFERENCES "KidProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_toyId_fkey" FOREIGN KEY ("toyId") REFERENCES "Toy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

