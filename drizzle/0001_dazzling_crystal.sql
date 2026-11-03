CREATE TABLE `fx_rate` (
	`currency` text NOT NULL,
	`date` text NOT NULL,
	`aud_per_unit` real NOT NULL,
	`source` text NOT NULL,
	`fetched_at` text NOT NULL,
	PRIMARY KEY(`currency`, `date`)
);
--> statement-breakpoint
CREATE TABLE `month_run` (
	`id` text PRIMARY KEY NOT NULL,
	`month_key` text NOT NULL,
	`mode` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text NOT NULL,
	`result_json` text NOT NULL
);
