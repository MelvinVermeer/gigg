-- Drop booking status 'played' (played = past + confirmed) and record who created each event.
-- Data fixes run with the audit trigger off: they're not something a person did.
ALTER TABLE "events" DISABLE TRIGGER "audit";--> statement-breakpoint
UPDATE "events" SET "booking_status" = 'confirmed' WHERE "booking_status" = 'played';--> statement-breakpoint
UPDATE "changes" SET "before" = jsonb_set("before", '{booking_status}', '"confirmed"') WHERE "table_name" = 'events' AND "before"->>'booking_status' = 'played';--> statement-breakpoint
UPDATE "changes" SET "after" = jsonb_set("after", '{booking_status}', '"confirmed"') WHERE "table_name" = 'events' AND "after"->>'booking_status' = 'played';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "booking_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "booking_status" SET DEFAULT 'lead'::text;--> statement-breakpoint
DROP TYPE "public"."booking_status";--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('lead', 'option', 'confirmed', 'cancelled');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "booking_status" SET DEFAULT 'lead'::"public"."booking_status";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "booking_status" SET DATA TYPE "public"."booking_status" USING "booking_status"::"public"."booking_status";--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "events" e SET "created_by" = c."user_id" FROM "changes" c WHERE c."table_name" = 'events' AND c."action" = 'insert' AND c."row_id" = e."id"::text AND c."user_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ENABLE TRIGGER "audit";
