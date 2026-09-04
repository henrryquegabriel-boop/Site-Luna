CREATE TABLE `invitation_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`admin_email` text NOT NULL,
	`previous_answers` text NOT NULL,
	`new_answers` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `invitation_families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_invitation_corrections_family` ON `invitation_corrections` (`family_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_invitation_members` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`attendance` text DEFAULT 'pendente' NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `invitation_families`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "invitation_member_kind" CHECK("__new_invitation_members"."kind" IN ('adulto', 'crianca', 'crianca_menor5', 'nao_informado')),
	CONSTRAINT "invitation_member_attendance" CHECK("__new_invitation_members"."attendance" IN ('pendente', 'sim', 'nao'))
);
--> statement-breakpoint
INSERT INTO `__new_invitation_members`("id", "family_id", "name", "kind", "position", "attendance") SELECT "id", "family_id", "name", "kind", "position", "attendance" FROM `invitation_members`;--> statement-breakpoint
DROP TABLE `invitation_members`;--> statement-breakpoint
ALTER TABLE `__new_invitation_members` RENAME TO `invitation_members`;--> statement-breakpoint
CREATE INDEX `idx_invitation_members_family` ON `invitation_members` (`family_id`,`position`);--> statement-breakpoint
CREATE VIEW `guest_invitations` AS SELECT f.id AS ID_Convidado, f.head_name AS Nome_Chefe_Familia,
  f.token AS Token_Unico,
  MAX((SELECT COUNT(*) FROM invitation_members m WHERE m.family_id = f.id) - 1, 0) AS Limite_Acompanhantes,
  CASE WHEN f.responded_at IS NULL THEN 'Pendente' ELSE 'Confirmado' END AS Status_Confirmacao
  FROM invitation_families f;
