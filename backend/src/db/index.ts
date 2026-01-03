import Database from "better-sqlite3";
import { readFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig } from "../services/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const config = loadConfig();
    const dbPath = config.database.path;

    // Ensure directory exists
    const dbDir = path.dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Initialize schema
    const schemaPath = path.join(__dirname, "schema.sql");
    console.log(`Initializing database schema from ${schemaPath}`);
    const schema = readFileSync(schemaPath, "utf-8");
    db.exec(schema);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
