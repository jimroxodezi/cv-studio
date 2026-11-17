import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { ensureProfile, getOwnedVariant } from "@/lib/guards";
import { variantToData } from "@/lib/cv-document";
import { PageHeader } from "@/components/ui";
import { VariantEditor } from "@/components/variant-editor";

export const dynamic = "force-dynamic";

export default async function VariantPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return null;
  const { id } = await params;
  const [profile, variant] = await Promise.all([ensureProfile(user), getOwnedVariant(user.id, id)]);

  return (
    <div>
      <PageHeader
        eyebrow="Variant"
        title={variant.name}
        description="Choose what this angle shows. The preview compiles to the same LaTeX template used for every application."
        actions={
          <>
            <Link href="/variants" className="btn-secondary">
              All variants
            </Link>
            <Link href={`/jobs?fromVariant=${variant.id}`} className="btn-primary">
              Tailor to a job
            </Link>
          </>
        }
      />
      <VariantEditor variantId={variant.id} initial={variantToData(variant)} profile={profile} />
    </div>
  );
}
