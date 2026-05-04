ALTER TABLE `profiles` ADD `last_modified` integer DEFAULT '"1970-01-01T00:00:00.000Z"' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `curseforge_profile_created_at` integer;