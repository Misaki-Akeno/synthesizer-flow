CREATE TABLE "projects" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"data" jsonb NOT NULL,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_to_projects" (
	"user_id" varchar(255) NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'owner' NOT NULL,
	CONSTRAINT "users_to_projects_user_id_project_id_pk" PRIMARY KEY("user_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "settings" jsonb;--> statement-breakpoint
ALTER TABLE "users_to_projects" ADD CONSTRAINT "users_to_projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_to_projects" ADD CONSTRAINT "users_to_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_to_projects_user_id_idx" ON "users_to_projects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_to_projects_project_id_idx" ON "users_to_projects" USING btree ("project_id");