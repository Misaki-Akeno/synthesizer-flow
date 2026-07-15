DROP INDEX "users_to_projects_user_id_idx";--> statement-breakpoint
DROP INDEX "verification_tokens_identifier_idx";--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "checkpoints" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "langgraph_checkpoints" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "langgraph_checkpoints" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "schema_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD COLUMN "namespace" varchar(128) DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD COLUMN "source_id" varchar(255);--> statement-breakpoint
ALTER TABLE "rag_documents" ADD COLUMN "content_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "rag_documents" ADD COLUMN "chunk_index" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users_to_projects" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "users_to_projects" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users_to_projects" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "checkpoints_user_created_at_idx" ON "checkpoints" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "langgraph_checkpoints_thread_created_at_idx" ON "langgraph_checkpoints" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "projects_preset_updated_at_idx" ON "projects" USING btree ("is_preset","updated_at");--> statement-breakpoint
CREATE INDEX "projects_archived_at_idx" ON "projects" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "rag_documents_namespace_source_idx" ON "rag_documents" USING btree ("namespace","source_id");--> statement-breakpoint
CREATE INDEX "rag_documents_content_hash_idx" ON "rag_documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires");--> statement-breakpoint
CREATE INDEX "verification_tokens_expires_idx" ON "verification_tokens" USING btree ("expires");--> statement-breakpoint
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_schema_version_check" CHECK ("checkpoints"."schema_version" > 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_schema_version_check" CHECK ("projects"."schema_version" > 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_revision_check" CHECK ("projects"."revision" > 0);--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_chunk_index_check" CHECK ("rag_documents"."chunk_index" IS NULL OR "rag_documents"."chunk_index" >= 0);--> statement-breakpoint
ALTER TABLE "users_to_projects" ADD CONSTRAINT "users_to_projects_role_check" CHECK (role IN ('owner', 'editor', 'viewer'));