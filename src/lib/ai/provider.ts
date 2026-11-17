import "server-only";
import { env } from "@/lib/env";
import { UserError } from "@/lib/api";
import { decryptSecret } from "@/lib/crypto";
import type { UserRow } from "@/lib/db/schema";

export type ProviderId = "openai" | "anthropic" | "openrouter" | "deepseek";

export type ProviderConfig = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  usedServerKey: boolean;
};

function ownKey(user: UserRow, provider: ProviderId): string {
  if (provider === "openai") return decryptSecret(user.openaiKey);
  if (provider === "anthropic") return decryptSecret(user.anthropicKey);
  if (provider === "openrouter") return decryptSecret(user.openrouterKey);
  if (provider === "deepseek") return decryptSecret(user.deepseekKey);
  return "";
}

export function resolveProvider(user: UserRow): ProviderConfig {
  const preferred = (user.provider || env.defaultProvider) as ProviderId;
  const valid: ProviderId[] = ["openai", "anthropic", "openrouter", "deepseek"];
  const provider = valid.includes(preferred) ? preferred : "openai";

  const preferredKey = ownKey(user, provider);
  if (preferredKey) {
    return {
      provider,
      apiKey: preferredKey,
      model: user.model || env.defaultModel,
      baseUrl: baseUrlFor(provider),
      usedServerKey: false,
    };
  }

  for (const candidate of valid) {
    const key = ownKey(user, candidate);
    if (key) {
      return {
        provider: candidate,
        apiKey: key,
        model: user.model || env.defaultModel,
        baseUrl: baseUrlFor(candidate),
        usedServerKey: false,
      };
    }
  }

  if (!env.defaultApiKey) {
    throw new UserError(
      "No AI key is configured. Add one in Settings, or ask the admin to set a server key.",
    );
  }

  return {
    provider: (env.defaultProvider as ProviderId) || "openai",
    apiKey: env.defaultApiKey,
    model: env.defaultModel,
    baseUrl: env.defaultBaseUrl || baseUrlFor((env.defaultProvider as ProviderId) || "openai"),
    usedServerKey: true,
  };
}

function baseUrlFor(provider: ProviderId): string {
  if (provider === "anthropic") return "https://api.anthropic.com/v1";
  if (provider === "openrouter") return "https://openrouter.ai/api/v1";
  // DeepSeek speaks the OpenAI chat-completions API at the root path.
  if (provider === "deepseek") return "https://api.deepseek.com";
  return "https://api.openai.com/v1";
}

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new UserError("The model did not return JSON.", 502);
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function openAiCompatible(
  config: ProviderConfig,
  system: string,
  user: string,
  maxTokens: number,
  jsonMode: boolean,
): Promise<string> {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: "json_object" };

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${config.apiKey}`,
  };
  if (config.provider === "openrouter") {
    headers["http-referer"] = env.appUrl;
    headers["x-title"] = "CV Studio";
  }

  let response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok && jsonMode) {
    const detail = await response.text();
    if (/response_format|json mode/i.test(detail)) {
      delete body.response_format;
      response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });
    } else {
      throw new UserError(`AI provider error (${response.status}): ${detail.slice(0, 300)}`, 502);
    }
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new UserError(`AI provider error (${response.status}): ${detail.slice(0, 300)}`, 502);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new UserError("The AI provider returned an empty response.", 502);
  return content;
}

async function anthropic(
  config: ProviderConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      system: `${system}\n\nReturn only a JSON object. No prose, no markdown fences.`,
      messages: [{ role: "user", content: user }],
      temperature: 0.2,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new UserError(`AI provider error (${response.status}): ${detail.slice(0, 300)}`, 502);
  }
  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const content = (data.content ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
  if (!content) throw new UserError("The AI provider returned an empty response.", 502);
  return content;
}

export async function completeJson<T>(options: {
  config: ProviderConfig;
  system: string;
  user: string;
  maxTokens?: number;
  validate: (value: unknown) => T;
}): Promise<T> {
  const maxTokens = options.maxTokens ?? 5000;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const instruction =
      attempt === 0
        ? options.user
        : `${options.user}\n\nYour previous reply was invalid. Return only a JSON object with exactly the requested keys.`;
    const raw =
      options.config.provider === "anthropic"
        ? await anthropic(options.config, options.system, instruction, maxTokens)
        : await openAiCompatible(options.config, options.system, instruction, maxTokens, true);
    try {
      return options.validate(parseJson(raw));
    } catch (err) {
      lastError = err;
    }
  }

  throw new UserError(
    `The model returned data this app could not use. ${lastError instanceof Error ? lastError.message : ""}`.trim(),
    502,
  );
}
