"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Card, Field } from "@/components/ui";

const providers = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "deepseek", label: "DeepSeek" },
] as const;

type ProviderKey = (typeof providers)[number]["id"];

// Used only to prefill the model field when it is empty or still holds another
// provider's default. The field stays free text.
const suggestedModels: Record<ProviderKey, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5",
  openrouter: "openai/gpt-4o-mini",
  deepseek: "deepseek-chat",
};

export function SettingsForm({
  initial,
  serverKeyAvailable,
}: {
  initial: {
    provider: string;
    model: string;
    configured: Record<ProviderKey, boolean>;
  };
  serverKeyAvailable: boolean;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(initial.provider || "openai");
  const [model, setModel] = useState(initial.model);
  const [configured, setConfigured] = useState(initial.configured);
  const [keys, setKeys] = useState<Record<ProviderKey, string>>({
    openai: "",
    anthropic: "",
    openrouter: "",
    deepseek: "",
  });
  const [clear, setClear] = useState<Record<ProviderKey, boolean>>({
    openai: false,
    anthropic: false,
    openrouter: false,
    deepseek: false,
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const payloadKeys: Record<string, string | undefined> = {};
      for (const id of providers.map((item) => item.id)) {
        if (clear[id]) payloadKeys[id] = "";
        else if (keys[id].trim()) payloadKeys[id] = keys[id].trim();
      }
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, model, keys: payloadKeys }),
      });
      const data = (await response.json()) as {
        error?: string;
        configured?: { openai: boolean; anthropic: boolean; openrouter: boolean };
      };
      if (!response.ok) throw new Error(data.error || "Could not save.");
      if (data.configured) setConfigured(data.configured);
      setKeys({ openai: "", anthropic: "", openrouter: "", deepseek: "" });
      setClear({ openai: false, anthropic: false, openrouter: false, deepseek: false });
      setStatus("Saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const anyKey = configured.openai || configured.anthropic || configured.openrouter || serverKeyAvailable;

  return (
    <form onSubmit={save} className="space-y-5">
      {!anyKey ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-900">No AI key available</p>
          <p className="mt-1 text-sm text-amber-800">
            Add your own key below, or ask the admin to set a server-side default. Without a key
            you can still edit your memory and build variants, but not import or tailor.
          </p>
        </Card>
      ) : null}

      <Card className="p-6">
        <h2 className="font-serif text-xl font-bold">AI provider</h2>
        <p className="hint mb-4">
          Your own key is encrypted at rest and only used for your generations. If you leave it
          blank, the server default is used, subject to the daily free limit.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Provider">
            <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}>
              {providers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Model" hint="For example gpt-4o-mini, claude-sonnet-4-5, or an OpenRouter model id.">
            <input className="input" value={model} onChange={(e) => setModel(e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-serif text-xl font-bold">API keys</h2>
        <p className="hint mb-4">Leave a field blank to keep the current key. Use Clear to remove it.</p>
        <div className="space-y-4">
          {providers.map((item) => {
            const id = item.id;
            return (
              <div key={id} className="rounded-xl border border-stone-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-stone-800">{item.label}</span>
                    {configured[id] ? <Badge tone="green">configured</Badge> : <Badge>not set</Badge>}
                  </div>
                  {configured[id] ? (
                    <label className="flex items-center gap-2 text-xs text-stone-600">
                      <input
                        type="checkbox"
                        checked={clear[id]}
                        onChange={(e) => setClear({ ...clear, [id]: e.target.checked })}
                      />
                      Clear on save
                    </label>
                  ) : null}
                </div>
                <input
                  className="input font-mono text-xs"
                  type="password"
                  autoComplete="off"
                  placeholder={configured[id] ? "•••••••• (stored)" : "Paste a key"}
                  value={keys[id]}
                  disabled={clear[id]}
                  onChange={(e) => setKeys({ ...keys, [id]: e.target.value })}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {status ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}

      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
