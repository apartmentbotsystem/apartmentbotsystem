/*
  Warnings:

  - Added the required column `content` to the `DocumentTemplate` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file` to the `DocumentVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentTemplate" ADD COLUMN     "content" BYTEA NOT NULL;

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "file" BYTEA NOT NULL;
