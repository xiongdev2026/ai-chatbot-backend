-- DropIndex
DROP INDEX "chat_logs_embedding_hnsw_idx";

-- DropIndex
DROP INDEX "knowledge_chunks_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "chat_logs" ADD COLUMN     "response_time_ms" INTEGER;
