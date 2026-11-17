import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { json, error } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return json({ ok: true });
  } catch {
    return error("Database is not reachable.", 503);
  }
}
