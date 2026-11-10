ALTER TABLE "changes" ADD COLUMN "tx_id" bigint DEFAULT txid_current() NOT NULL;--> statement-breakpoint
CREATE INDEX "changes_tx_idx" ON "changes" USING btree ("tx_id");