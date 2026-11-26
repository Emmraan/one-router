CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`message_id` text,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage` text NOT NULL,
	`object_key` text,
	`data` blob,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`message_id`) REFERENCES `messages`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "attachments_size" CHECK("attachments"."size" >= 0 AND "attachments"."size" <= 10485760),
	CONSTRAINT "attachments_storage" CHECK(("attachments"."storage" = 'sqlite' AND "attachments"."data" IS NOT NULL AND "attachments"."object_key" IS NULL) OR ("attachments"."storage" IN ('filesystem', 's3') AND "attachments"."data" IS NULL AND "attachments"."object_key" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `attachments_message` ON `attachments` (`user_id`,`message_id`);--> statement-breakpoint
CREATE INDEX `attachments_expiry` ON `attachments` (`expires_at`);--> statement-breakpoint
CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider_id` text,
	`model` text NOT NULL,
	`title` text NOT NULL,
	`manual_title` integer DEFAULT false NOT NULL,
	`is_pinned` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`provider_id`) REFERENCES `providers`(`user_id`,`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chats_owner_id` ON `chats` (`user_id`,`id`);--> statement-breakpoint
CREATE INDEX `chats_owner_page` ON `chats` (`user_id`,`deleted_at`,`is_pinned`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX `chats_provider` ON `chats` (`user_id`,`provider_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`model` text,
	`position` integer NOT NULL,
	`is_regenerated` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`,`chat_id`) REFERENCES `chats`(`user_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "messages_valid_role" CHECK("messages"."role" IN ('user', 'assistant', 'system')),
	CONSTRAINT "messages_valid_position" CHECK("messages"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `messages_owner_id` ON `messages` (`user_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `messages_chat_position` ON `messages` (`chat_id`,`position`);--> statement-breakpoint
CREATE TABLE `providers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`config` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `providers_owner_id` ON `providers` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`password_hash` text NOT NULL,
	`profile` text,
	`must_change_password` integer DEFAULT true NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_single_owner` ON `users` (`role`) WHERE "users"."role" = 'owner';
