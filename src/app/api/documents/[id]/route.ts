import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { error, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const rows = await getDb().select().from(documents).where(eq(documents.id, id)).limit(1);
    const document = rows[0];
    if (!document || document.userId !== user.id) return error("That document could not be found.", 404);

    const format = request.nextUrl.searchParams.get("format") ?? "pdf";
    const download = request.nextUrl.searchParams.get("download") === "1";
    const safeName = (document.label || "cv")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60);

    if (format === "tex") {
      return new Response(document.latex, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": `${download ? "attachment" : "inline"}; filename="${safeName}.tex"`,
        },
      });
    }

    if (format === "txt" || format === "ats") {
      return new Response(document.atsText, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "content-disposition": `${download ? "attachment" : "inline"}; filename="${safeName}.txt"`,
        },
      });
    }

    return new Response(new Uint8Array(document.pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${download ? "attachment" : "inline"}; filename="${safeName}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") return error("Sign in to continue.", 401);
    return handleError(err);
  }
}
