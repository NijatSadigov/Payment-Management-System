-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_received_by_manager_id_fkey";

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "received_by_manager_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_manager_id_fkey" FOREIGN KEY ("received_by_manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
