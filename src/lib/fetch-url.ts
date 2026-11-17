import "server-only";
import { lookup } from "node:dns/promises";
import net from "node:net";
import * as cheerio from "cheerio";
import { UserError } from "@/lib/api";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    return false;
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    return (
      lower === "::1" ||
      lower === "::" ||
      lower.startsWith("fc") ||
      lower.startsWith("fd") ||
      lower.startsWith("fe80") ||
      lower.startsWith("::ffff:127.") ||
      lower.startsWith("::ffff:10.") ||
      lower.startsWith("::ffff:192.168.")
    );
  }
  return true;
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UserError("Only http and https links are supported.");
  }
  if (url.username || url.password) throw new UserError("Links with credentials are not supported.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length) throw new UserError("Could not resolve that host.");
  if (addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new UserError("That link points to a private address and cannot be fetched.");
  }
}

export async function fetchJobDescription(input: string): Promise<{ title: string; text: string; url: string }> {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new UserError("That does not look like a valid URL. Paste the job text instead.");
  }

  let response: Response | null = null;
  let current = url;
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "CVStudio/1.0 (+job description reader)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        },
      });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) break;
      current = new URL(location, current);
      continue;
    }
    break;
  }

  if (!response) throw new UserError("Could not fetch that link.");
  if (!response.ok) {
    throw new UserError(`The site returned ${response.status}. Paste the job text instead.`);
  }
  const length = Number(response.headers.get("content-length") || "0");
  if (length > MAX_BYTES) throw new UserError("That page is too large to read.");

  const html = (await response.text()).slice(0, MAX_BYTES);
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer, header, form, iframe").remove();
  const title = ($("title").first().text() || $("h1").first().text() || "").trim();
  const candidate = $("main, article, [role='main'], .job-description, #job-description, .content").first();
  let content = (candidate.length ? candidate : $("body")).text();
  content = content.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  if (content.length < 200) {
    throw new UserError("That page did not contain enough readable text. Paste the job description instead.");
  }

  return { title: title.slice(0, 300), text: content.slice(0, 60_000), url: current.toString() };
}
