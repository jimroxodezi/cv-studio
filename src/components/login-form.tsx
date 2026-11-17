"use client";

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [devUrl, setDevUrl] = useState("");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setDevUrl("");
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string; message?: string; devUrl?: string };
      if (!response.ok) throw new Error(data.error || "Could not send a link.");
      setMessage(data.message || "If that address can sign in, a link is on its way.");
      if (data.devUrl) setDevUrl(data.devUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="label">Email address</span>
        <input
          className="input"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Sending link…" : "Email me a sign-in link"}
      </button>
      {message ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
      {devUrl ? (
        <a href={devUrl} className="block break-all rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
          Development mode: open the sign-in link
        </a>
      ) : null}
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <p className="hint">
        No password. The link expires in 20 minutes and works once. Access is invite-only.
      </p>
    </form>
  );
}
