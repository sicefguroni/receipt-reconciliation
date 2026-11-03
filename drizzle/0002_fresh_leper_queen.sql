CREATE TABLE `decision` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`run_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text NOT NULL,
	`after_json` text NOT NULL,
	`reason` text,
	`at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `month_run`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `decision_id_unique` ON `decision` (`id`);--> statement-breakpoint
CREATE TABLE `vendor_rule` (
	`keyword` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`decision_id` text NOT NULL,
	`created_at` text NOT NULL
);
