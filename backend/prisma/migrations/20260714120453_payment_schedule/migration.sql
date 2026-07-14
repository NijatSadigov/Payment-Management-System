/*
  Warnings:

  - You are about to drop the column `pay_deadline` on the `customers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "customers" DROP COLUMN "pay_deadline",
ADD COLUMN     "pay_link_active" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "installments" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount_due" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "installments_customer_id_sequence_key" ON "installments"("customer_id", "sequence");

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
