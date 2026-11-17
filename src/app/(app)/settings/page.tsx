import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Your studio"
        description="Choose the model that writes your drafts. Your key stays encrypted; the server default is shared and rate-limited."
      />
      <SettingsForm
        initial={{
          provider: user.provider,
          model: user.model,
          configured: {
            openai: Boolean(user.openaiKey),
            anthropic: Boolean(user.anthropicKey),
            openrouter: Boolean(user.openrouterKey),
            deepseek: Boolean(user.deepseekKey),
          },
        }}
        serverKeyAvailable={Boolean(env.defaultApiKey)}
      />
    </div>
  );
}
