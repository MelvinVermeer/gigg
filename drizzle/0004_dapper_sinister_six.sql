CREATE TYPE "public"."availability_answer" AS ENUM('yes', 'no', 'maybe');--> statement-breakpoint
CREATE TABLE "availability_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"date" date NOT NULL,
	"asked_by" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answer" "availability_answer",
	"note" text,
	"token_hash" text NOT NULL,
	"answered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "availability_responses_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "availability_responses_request_id_user_id_unique" UNIQUE("request_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_requests" ADD CONSTRAINT "availability_requests_asked_by_users_id_fk" FOREIGN KEY ("asked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_request_id_availability_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."availability_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_responses" ADD CONSTRAINT "availability_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "availability_one_open" ON "availability_requests" USING btree ("event_id") WHERE "availability_requests"."closed_at" is null;--> statement-breakpoint
create trigger audit after insert or update or delete on availability_requests for each row execute function audit();
--> statement-breakpoint
create trigger audit after insert or update or delete on availability_responses for each row execute function audit();
