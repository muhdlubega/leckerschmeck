import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sharedRecipes = sqliteTable('shared_recipes', {
  id: text('id').primaryKey(),
  recipeJson: text('recipe_json').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
}, (table) => [index('idx_shared_recipes_expires_at').on(table.expiresAt)]);

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: integer('reset_at').notNull(),
}, (table) => [index('idx_rate_limits_reset_at').on(table.resetAt)]);
