CREATE TABLE `files` (
	`profile_id` integer NOT NULL,
	`filepath` text NOT NULL,
	`last_modified` integer NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`profile_id`, `filepath`),
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`mc_version` text NOT NULL,
	`forge_version` text,
	`game_directory` text
);
