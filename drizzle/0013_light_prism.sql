CREATE TABLE "shown_fields" (
	"band_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"fields" jsonb NOT NULL,
	CONSTRAINT "shown_fields_band_id_user_id_pk" PRIMARY KEY("band_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "song_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"band_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "songs" ADD COLUMN "custom" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "shown_fields" ADD CONSTRAINT "shown_fields_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shown_fields" ADD CONSTRAINT "shown_fields_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_fields" ADD CONSTRAINT "song_fields_band_id_bands_id_fk" FOREIGN KEY ("band_id") REFERENCES "public"."bands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "song_fields_name" ON "song_fields" USING btree ("band_id",lower("name"));--> statement-breakpoint
create trigger audit after insert or update or delete on song_fields for each row execute function audit();
