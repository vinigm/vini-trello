import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const kanbanBoards = sqliteTable("kanban_boards", {
  id: text("id").primaryKey(),
  stateJson: text("state_json").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
