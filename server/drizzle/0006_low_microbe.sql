CREATE TABLE `curseforgeFingerprints` (
	`fingerprint` integer PRIMARY KEY NOT NULL,
	`match` integer NOT NULL,
	`projectID` integer,
	`fileID` integer
);
