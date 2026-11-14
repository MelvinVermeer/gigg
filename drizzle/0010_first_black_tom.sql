CREATE TABLE "event_people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answer" "availability_answer",
	"note" text,
	"token_hash" text,
	"asked_for" date,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_people_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "event_people_event_id_user_id_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "event_people" ADD CONSTRAINT "event_people_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_people" ADD CONSTRAINT "event_people_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_people" ADD CONSTRAINT "event_people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Everyone asked in an old check moves onto the event's list with their latest answer (unanswered = waiting).
-- Their old emailed link keeps working (same token hash). Copied before the audit trigger exists: not something a person did.
INSERT INTO "event_people" ("band_id", "event_id", "user_id", "answer", "note", "token_hash", "asked_for", "answered_at", "created_at")
SELECT DISTINCT ON (q."event_id", r."user_id") r."band_id", q."event_id", r."user_id", r."answer", r."note", r."token_hash", q."date", r."answered_at", r."created_at"
FROM "availability_responses" r JOIN "availability_requests" q ON q."id" = r."request_id"
ORDER BY q."event_id", r."user_id", q."created_at" DESC;--> statement-breakpoint
create trigger audit after insert or update or delete on event_people for each row execute function audit();
