import Link from "next/link";
import type { ProfileSuggestion } from "@/lib/profile";
import { Badge, Card } from "@/components/ui";

const TONES: Record<ProfileSuggestion["priority"], "amber" | "neutral"> = {
  high: "amber",
  medium: "neutral",
  low: "neutral",
};

const LABELS: Record<ProfileSuggestion["priority"], string> = {
  high: "Important",
  medium: "Useful",
  low: "Optional",
};

function Row({ suggestion }: { suggestion: ProfileSuggestion }) {
  return (
    <li className="flex items-start gap-2 py-1.5 text-sm">
      <Badge tone={TONES[suggestion.priority]}>{LABELS[suggestion.priority]}</Badge>
      <span className="text-stone-700">
        <span className="font-semibold text-stone-900">{suggestion.area}:</span> {suggestion.text}
      </span>
    </li>
  );
}

export function ProfileSuggestions({
  suggestions,
  compact = false,
}: {
  suggestions: ProfileSuggestion[];
  compact?: boolean;
}) {
  if (!suggestions.length) return null;

  if (compact) {
    return (
      <Card className="border-sky-200 bg-sky-50/50 p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-bold text-sky-950">Strengthen your CV</h2>
          <Link href="/profile" className="text-xs font-semibold text-sky-900 underline underline-offset-2">
            Add these details →
          </Link>
        </div>
        <ul className="divide-y divide-sky-100">
          {suggestions.slice(0, 3).map((suggestion) => (
            <Row key={`${suggestion.area}-${suggestion.text}`} suggestion={suggestion} />
          ))}
        </ul>
        {suggestions.length > 3 ? (
          <p className="mt-2 text-xs text-sky-900/70">+ {suggestions.length - 3} more on the memory page.</p>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-sky-200 bg-sky-50/50 p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-lg font-bold text-sky-950">Make this CV stronger</h2>
        <Badge tone="blue">{suggestions.length} things to add</Badge>
      </div>
      <p className="text-sm text-sky-900/80">
        These are facts only you can supply. Anything you leave out stays out of the CV — the studio will not fill
        gaps on its own.
      </p>
      <ul className="mt-2 divide-y divide-sky-100">
        {suggestions.map((suggestion) => (
          <Row key={`${suggestion.area}-${suggestion.text}`} suggestion={suggestion} />
        ))}
      </ul>
    </Card>
  );
}
