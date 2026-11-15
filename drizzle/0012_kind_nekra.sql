ALTER TYPE "public"."payment_status" ADD VALUE 'free';--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "fee" text;