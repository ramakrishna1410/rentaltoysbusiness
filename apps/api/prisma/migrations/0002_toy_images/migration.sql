-- CreateTable
CREATE TABLE "ToyImage" (
    "id" TEXT NOT NULL,
    "toyId" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToyImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToyImage_toyId_sortOrder_idx" ON "ToyImage"("toyId", "sortOrder");

-- AddForeignKey
ALTER TABLE "ToyImage" ADD CONSTRAINT "ToyImage_toyId_fkey" FOREIGN KEY ("toyId") REFERENCES "Toy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

