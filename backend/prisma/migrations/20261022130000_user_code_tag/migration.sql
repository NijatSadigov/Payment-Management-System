-- AlterTable
ALTER TABLE "users" ADD COLUMN     "code_tag" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_code_tag_key" ON "users"("code_tag");
