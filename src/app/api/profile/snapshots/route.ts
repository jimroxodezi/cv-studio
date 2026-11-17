import type { NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, error, handleError, json, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getProfileRow } from "@/lib/guards";
import { hasContent, listSnapshots, snapshotProfile } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  label: z.string().max(160).optional().default(""),
});

export async function GET() {
  try {
    const user = await requireUser();
    const snapshots = await listSnapshots(user.id);
    return json({ snapshots });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = await readJson(request, createSchema);
    const row = await getProfileRow(user.id);

    if (!row) return error("There is no career memory to snapshot yet.", 400);
    if (!hasContent(row.data, row.rawDump)) {
      return error("The career memory is empty, so there is nothing to snapshot.", 400);
    }

    const id = await snapshotProfile({
      userId: user.id,
      data: row.data,
      rawDump: row.rawDump,
      reason: "manual",
      label: body.label.trim(),
    });

    return json({ ok: true, id });
  } catch (err) {
    return handleError(err);
  }
}
