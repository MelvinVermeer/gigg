CREATE TABLE "calendar_feeds" (
	"band_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_feeds_band_id_user_id_pk" PRIMARY KEY("band_id","user_id"),
	CONSTRAINT "calendar_feeds_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "bands" ADD COLUMN "time_zone" text DEFAULT 'Europe/Amsterdam' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "end_time" time;--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_feeds" ADD CONSTRAINT "calendar_feeds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;