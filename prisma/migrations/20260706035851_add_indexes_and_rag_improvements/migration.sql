-- DropIndex
DROP INDEX "doctors_department_id_idx";

-- DropIndex
DROP INDEX "medical_services_department_id_idx";

-- AlterTable
ALTER TABLE "faqs" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "knowledge_chunks" ADD COLUMN     "metadata" JSONB;

-- CreateIndex
CREATE INDEX "chat_logs_created_at_idx" ON "chat_logs"("created_at");

-- CreateIndex
CREATE INDEX "departments_is_active_idx" ON "departments"("is_active");

-- CreateIndex
CREATE INDEX "doctors_department_id_is_active_idx" ON "doctors"("department_id", "is_active");

-- CreateIndex
CREATE INDEX "doctors_specialty_idx" ON "doctors"("specialty");

-- CreateIndex
CREATE INDEX "faqs_category_idx" ON "faqs"("category");

-- CreateIndex
CREATE INDEX "faqs_is_active_idx" ON "faqs"("is_active");

-- CreateIndex
CREATE INDEX "knowledge_sources_is_active_idx" ON "knowledge_sources"("is_active");

-- CreateIndex
CREATE INDEX "medical_services_department_id_is_active_idx" ON "medical_services"("department_id", "is_active");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "services_category_idx" ON "services"("category");

-- CreateIndex
CREATE INDEX "services_is_active_idx" ON "services"("is_active");

-- Lock in embedding dimension (Gemini embedding-001 = 768 dims) so an ANN index can be built.
-- Safe: both tables are empty at time of writing this migration.
ALTER TABLE "knowledge_chunks" ALTER COLUMN "embedding" TYPE vector(768);
ALTER TABLE "chat_logs" ALTER COLUMN "embedding" TYPE vector(768);

-- Approximate-nearest-neighbor indexes for cosine distance (<=>), matching the operator
-- used in embedding.service.ts. Without these, similarity search is a full sequential scan.
CREATE INDEX "knowledge_chunks_embedding_hnsw_idx" ON "knowledge_chunks" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "chat_logs_embedding_hnsw_idx" ON "chat_logs" USING hnsw ("embedding" vector_cosine_ops);

-- Defense-in-depth: enforce rating bounds at the DB level (Prisma schema can't express CHECK constraints).
ALTER TABLE "chat_feedback" ADD CONSTRAINT "chat_feedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
