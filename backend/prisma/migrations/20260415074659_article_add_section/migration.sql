-- CreateEnum
CREATE TYPE "ArticleSection" AS ENUM ('EDITORIAL', 'FEATURE');

-- AlterTable
ALTER TABLE "Article" ADD COLUMN     "section" "ArticleSection" NOT NULL DEFAULT 'FEATURE';

-- CreateIndex
CREATE INDEX "Article_section_status_publishedAt_idx" ON "Article"("section", "status", "publishedAt");
