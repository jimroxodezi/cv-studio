import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { ImportDump } from "@/components/import-dump";

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Import"
        title="Turn a dump into a career memory"
        description="Paste everything you have. The extractor keeps your facts, splits them into atomic bullets, and flags what is ambiguous. Nothing is saved until you approve it."
        actions={
          <Link href="/profile" className="btn-secondary">
            Back to memory
          </Link>
        }
      />
      <ImportDump />
    </div>
  );
}
