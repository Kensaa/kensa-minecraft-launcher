ALTER TABLE `gameDirectories` ADD `last_modified` integer DEFAULT '"1970-01-01T00:00:00.000Z"' NOT NULL;--> statement-breakpoint
ALTER TABLE `gameDirectories` ADD `tarball_created_at` integer;