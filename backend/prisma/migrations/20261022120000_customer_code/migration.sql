-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "code" TEXT,
ADD COLUMN     "created_by_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "customers_code_key" ON "customers"("code");
