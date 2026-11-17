import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { assertSameOrigin, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["openai", "anthropic", "openrouter", "deepseek"]).optional(),
  model: z.string().trim().max(120).optional(),
  keys: z
    .object({
      openai: z.string().max(300).optional(),
      anthropic: z.string().max(300).optional(),
      openrouter: z.string().max(300).optional(),
      deepseek: z.string().max(300).optional(),
    })
    .optional(),
});

export async function PUT(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = await readJson(request, schema);
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.provider) updates.provider = body.provider;
    if (body.model !== undefined) updates.model = body.model;

    if (body.keys) {
      if (body.keys.openai !== undefined) {
        updates.openaiKey = body.keys.openai.trim() ? encryptSecret(body.keys.openai.trim()) : "";
      }
      if (body.keys.anthropic !== undefined) {
        updates.anthropicKey = body.keys.anthropic.trim()
          ? encryptSecret(body.keys.anthropic.trim())
          : "";
      }
      if (body.keys.openrouter !== undefined) {
        updates.openrouterKey = body.keys.openrouter.trim()
          ? encryptSecret(body.keys.openrouter.trim())
          : "";
      }
      if (body.keys.deepseek !== undefined) {
        updates.deepseekKey = body.keys.deepseek.trim()
          ? encryptSecret(body.keys.deepseek.trim())
          : "";
      }
    }

    const rows = await getDb().update(users).set(updates).where(eq(users.id, user.id)).returning();
    const row = rows[0];
    return json({
      ok: true,
      provider: row.provider,
      model: row.model,
      configured: {
        openai: Boolean(row.openaiKey),
        anthropic: Boolean(row.anthropicKey),
        openrouter: Boolean(row.openrouterKey),
        deepseek: Boolean(row.deepseekKey),
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
