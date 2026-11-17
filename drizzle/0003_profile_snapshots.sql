CREATE TABLE "profile_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"raw_dump" text DEFAULT '' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"reason" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_snapshots_user_idx" ON "profile_snapshots" USING btree ("user_id","created_at");