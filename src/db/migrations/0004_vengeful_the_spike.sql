/* 
    Unfortunately in current drizzle-kit version we can't automatically get name for primary key.
    We are working on making it available!

    Meanwhile you can:
        1. Check pk name in your database, by running
            SELECT constraint_name FROM information_schema.table_constraints
            WHERE table_schema = 'public'
                AND table_name = 'langgraph_checkpoints'
                AND constraint_type = 'PRIMARY KEY';
        2. Uncomment code below and paste pk name manually
        
    Hope to release this update as soon as possible
*/

ALTER TABLE "langgraph_checkpoints" ADD COLUMN "checkpoint_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "langgraph_checkpoints" DROP CONSTRAINT "langgraph_checkpoints_pkey";--> statement-breakpoint
ALTER TABLE "langgraph_checkpoints" ADD CONSTRAINT "langgraph_checkpoints_thread_id_checkpoint_id_pk" PRIMARY KEY("thread_id","checkpoint_id");