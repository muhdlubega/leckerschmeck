CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rate_limits_reset_at` ON `rate_limits` (`reset_at`);--> statement-breakpoint
CREATE TABLE `shared_recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_shared_recipes_expires_at` ON `shared_recipes` (`expires_at`);