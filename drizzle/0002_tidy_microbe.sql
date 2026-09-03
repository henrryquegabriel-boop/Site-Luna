CREATE TABLE `invitation_families` (
	`id` text PRIMARY KEY NOT NULL,
	`family_key` text NOT NULL,
	`family_name` text NOT NULL,
	`head_name` text NOT NULL,
	`token` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`message` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`responded_at` text,
	CONSTRAINT "invitation_family_active" CHECK("invitation_families"."active" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitation_families_key` ON `invitation_families` (`family_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_invitation_families_token` ON `invitation_families` (`token`);--> statement-breakpoint
CREATE TABLE `invitation_members` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`attendance` text DEFAULT 'pendente' NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `invitation_families`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invitation_member_kind" CHECK("invitation_members"."kind" IN ('adulto', 'crianca')),
	CONSTRAINT "invitation_member_attendance" CHECK("invitation_members"."attendance" IN ('pendente', 'sim', 'nao'))
);
--> statement-breakpoint
CREATE INDEX `idx_invitation_members_family` ON `invitation_members` (`family_id`,`position`);