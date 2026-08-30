CREATE TABLE `rsvps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`guest_name` text NOT NULL,
	`attendance` text NOT NULL,
	`adults` integer DEFAULT 0 NOT NULL,
	`children` integer DEFAULT 0 NOT NULL,
	`phone` text NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
