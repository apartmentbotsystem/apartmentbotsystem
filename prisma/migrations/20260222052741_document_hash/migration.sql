/*
  Warnings:

  - Added the required column `hash` to the `DocumentVersion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "hash" TEXT NOT NULL;
