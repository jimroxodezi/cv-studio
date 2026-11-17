import { NextResponse, type NextRequest } from "next/server";
import { consumeAuthToken, acceptInvite } from "@/lib/auth-tokens";
import { createSession, findUserByEmail } from "@/lib/auth";
import { publicOrigin } from "@/lib/base-url";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const base = await publicOrigin();
  const fail = NextResponse.redirect(new URL("/login?error=invalid", base));

  if (!token) return fail;

  const email = await consumeAuthToken(token, "login");
  if (email) {
    const user = await findUserByEmail(email);
    if (!user) return fail;
    await createSession(user.id);
    return NextResponse.redirect(new URL("/dashboard", base));
  }

  const invited = await acceptInvite(token);
  if (invited) {
    const user = await findUserByEmail(invited.email);
    if (!user) return fail;
    await createSession(user.id);
    return NextResponse.redirect(new URL("/dashboard", base));
  }

  return fail;
}
