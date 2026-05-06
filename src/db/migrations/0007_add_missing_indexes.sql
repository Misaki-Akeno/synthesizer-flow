CREATE INDEX "checkpoints_user_id_idx" ON "checkpoints" ("user_id");
CREATE INDEX "checkpoints_created_at_idx" ON "checkpoints" ("created_at");
CREATE INDEX "projects_updated_at_idx" ON "projects" ("updated_at");
CREATE INDEX "projects_is_preset_idx" ON "projects" ("is_preset");

ALTER TABLE "projects" ADD COLUMN "description" text;

ALTER TABLE "users_to_projects" ADD CONSTRAINT "users_to_projects_role_check" CHECK (role IN ('owner', 'editor', 'viewer'));
