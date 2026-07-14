-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'epay');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'cash',
ADD COLUMN     "provider_ref" TEXT,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'completed';
