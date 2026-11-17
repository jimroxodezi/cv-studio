import type { NextRequest } from "next/server";
import { assertSameOrigin, json, handleError } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    await destroySession();
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
