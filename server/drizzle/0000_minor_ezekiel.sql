CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`hash` blob NOT NULL,
	`salt` blob NOT NULL,
	`temp_account` integer NOT NULL,
	`is_admin` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_username_unique` ON `accounts` (`username`);--> statement-breakpoint
CREATE TABLE `files` (
	`game_directory` text NOT NULL,
	`filepath` text NOT NULL,
	`last_modified` integer NOT NULL,
	`hash` text NOT NULL,
	PRIMARY KEY(`game_directory`, `filepath`),
	FOREIGN KEY (`game_directory`) REFERENCES `gameDirectories`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gameDirectories` (
	`name` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`mc_version` text NOT NULL,
	`forge_version` text,
	`game_directory` text,
	FOREIGN KEY (`game_directory`) REFERENCES `gameDirectories`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_name_unique` ON `profiles` (`name`);