CREATE TABLE "langgraph_checkpoints" (
	"thread_id" text PRIMARY KEY NOT NULL,
	"checkpoint" jsonb NOT NULL,
	"metadata" jsonb NOT NULL,
	"parent_checkpoint_id" text
);
--> statement-breakpoint
CREATE TABLE "langgraph_writes" (
	"thread_id" text NOT NULL,
	"checkpoint_id" text NOT NULL,
	"task_id" text NOT NULL,
	"idx" integer NOT NULL,
	"channel" text NOT NULL,
	"value" jsonb,
	CONSTRAINT "langgraph_writes_thread_id_checkpoint_id_task_id_idx_pk" PRIMARY KEY("thread_id","checkpoint_id","task_id","idx")
);
