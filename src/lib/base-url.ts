import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Public origin of the current request.
 *
 * Behind a tunnel (Tailscale Funnel, Cloudflare) the host the browser used is
 * the one links and redirects must point at — APP_URL only knows the address
 * the container was configured with. Proxies set X-Forwarded-Host/Proto, so use
 * those and fall back to APP_URL when there is no request (or no proxy).
 */
export async function publicOrigin(): Promise<string> {
  const h = await headers();
  const host = firstValue(h.get("x-forwarded-host")) || firstValue(h.get("host"));
  if (!host) return env.appUrl;

  const forwarded = firstValue(h.get("x-forwarded-proto"));
  const proto =
    forwarded === "http" || forwarded === "https"
      ? forwarded
      : env.appUrl.startsWith("https://")
        ? "https"
        : "http";

  return `${proto}://${host}`;
}

/** True when the browser reached us over HTTPS, even if APP_URL is local. */
export async function isHttpsRequest(): Promise<boolean> {
  return (await publicOrigin()).startsWith("https://");
}

function firstValue(value: string | null): string {
  return (value ?? "").split(",")[0]?.trim() ?? "";
}
