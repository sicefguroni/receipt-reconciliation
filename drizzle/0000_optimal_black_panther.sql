CREATE TABLE `run_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` text NOT NULL,
	`receipt_id` text,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`model_id` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`error_code` text,
	`at` text NOT NULL
);
