-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "pay_deadline" TIMESTAMP(3),
ADD COLUMN     "pay_min_amount" DOUBLE PRECISION,
ADD COLUMN     "pay_note" TEXT;
