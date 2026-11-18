"use client";

import { useEffect, useState } from "react";

/**
 * Renders every page of a stored PDF as stacked <img> elements instead of an
 * <iframe>. iOS Safari and Brave refuse to show more than the first page of a
 * PDF inside an iframe, so the iframe preview silently hid pages two and three.
 * Rasterising with pdf.js (via unpdf, already used server-side for ATS text)
 * shows the whole CV on every browser, and each page scales to the container
 * width so the preview is genuinely responsive.
 */
export function PdfPreview({ documentId, className = "" }: { documentId: string; className?: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      setError("");
      setPages([]);
      try {
        const response = await fetch(`/api/documents/${documentId}`);
        if (!response.ok) throw new Error("Could not load the PDF.");
        const bytes = new Uint8Array(await response.arrayBuffer());

        const { getDocumentProxy, renderPageAsImage } = await import("unpdf");
        const doc = await getDocumentProxy(bytes);
        try {
          const first = await doc.getPage(1);
          const base = first.getViewport({ scale: 1 });
          // ~1000px wide keeps text crisp on retina panels without wasting
          // memory on pages larger than the preview column can show.
          const scale = 1000 / base.width;
          const rendered: string[] = [];
          for (let page = 1; page <= doc.numPages; page += 1) {
            if (cancelled) return;
            const url = await renderPageAsImage(doc, page, { scale, toDataURL: true });
            rendered.push(url);
          }
          if (!cancelled) setPages(rendered);
        } finally {
          await doc.loadingTask.destroy();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not render the PDF.");
      }
    }

    void render();
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  if (error) {
    return (
      <div className={`${className} grid place-items-center p-6 text-center text-sm text-stone-500`}>
        {error}
      </div>
    );
  }

  if (!pages.length) {
    return (
      <div className={`${className} grid place-items-center p-6 text-center text-sm text-stone-500`}>
        Rendering pages…
      </div>
    );
  }

  return (
    <div className={`${className} overflow-y-auto`}>
      <div className="flex flex-col gap-3 p-3">
        {pages.map((src, index) => (
          // Data URLs are rendered as-is; next/image cannot handle them.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={src}
            alt={`Page ${index + 1}`}
            className="block w-full rounded-sm bg-white shadow-sm"
          />
        ))}
      </div>
    </div>
  );
}
