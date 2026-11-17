import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { LoginForm } from "@/components/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-stone-950 p-10 text-stone-300 lg:flex">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-amber-500 font-serif text-lg font-bold text-stone-950">
            C
          </span>
          <span className="font-serif text-xl font-bold text-white">CV Studio</span>
        </Link>
        <div>
          <blockquote className="max-w-md font-serif text-3xl leading-tight text-white">
            “The CV should be a selection from the truth, not a performance of it.”
          </blockquote>
          <p className="mt-4 text-sm text-stone-500">One career memory. Every application.</p>
        </div>
        <p className="text-xs text-stone-600">LaTeX typesetting · ATS-friendly · evidence-checked</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="font-serif text-2xl font-bold">
              CV Studio
            </Link>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-stone-900">Sign in</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Enter the email address that was invited. We&apos;ll send a one-time link — no
            password to remember.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
          {!env.smtpHost ? (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              This server sends no email. Ask the admin to send you a sign-in or invite link.
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              That link is invalid or has expired. Request a new one.
            </p>
          ) : null}
          <p className="mt-8 text-xs text-stone-500">
            Need access? Ask the person who invited you to send an invite from the Admin page.
          </p>
        </div>
      </div>
    </div>
  );
}
