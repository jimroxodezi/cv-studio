import type { NextRequest } from "next/server";
import { assertSameOrigin, error, handleError, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { extractCareerDump } from "@/lib/ai/import";
import { extractTextFromUpload } from "@/lib/extract-file";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    let dump = "";

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const text = form.get("text");
      if (file instanceof File && file.size > 0) {
        dump = await extractTextFromUpload(file);
      } else if (typeof text === "string") {
        dump = text;
      }
    } else {
      const body = (await request.json().catch(() => ({}))) as { text?: unknown };
      dump = typeof body.text === "string" ? body.text : "";
    }

    dump = dump.trim();
    if (dump.length < 80) return error("Add a little more to the dump — at least a few lines.", 400);
    if (dump.length > 100_000) return error("That dump is too long. Trim it to under 100,000 characters.", 400);

    const result = await extractCareerDump({ user, dump });
    return json({
      profile: result.profile,
      suggestedTracks: result.suggestedTracks,
      gaps: result.gaps,
      model: result.model,
    });
  } catch (err) {
    return handleError(err);
  }
}
