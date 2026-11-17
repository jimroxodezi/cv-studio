#!/usr/bin/env node
// Minimal migration runner. It reads the SQL files drizzle-kit generates and
// records their hashes in schema_migrations, so no ORM is needed at runtime
// (copying drizzle-orm into the image would add ~17 MB).
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const folder = "./drizzle";
const journal = JSON.parse(await readFile(path.join(folder, "meta/_journal.json"), "utf8"));

const client = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
try {
  await client`CREATE TABLE IF NOT EXISTS schema_migrations (
    hash text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  const rows = await client`SELECT hash FROM schema_migrations`;
  const applied = new Set(rows.map((row) => row.hash));

  for (const entry of journal.entries) {
    const sql = await readFile(path.join(folder, `${entry.tag}.sql`), "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    if (applied.has(hash)) continue;

    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    await client.begin(async (tx) => {
      for (const statement of statements) await tx.unsafe(statement);
      await tx`INSERT INTO schema_migrations (hash) VALUES (${hash})`;
    });
    console.log(`Applied ${entry.tag}`);
  }

  console.log("Database migrations applied.");
} finally {
  await client.end({ timeout: 5 });
}
