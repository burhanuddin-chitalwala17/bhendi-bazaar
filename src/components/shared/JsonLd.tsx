import { serializeJsonLd } from "@/lib/structured-data";

/**
 * Structured data for search engines. A data block, never executed, so the nonce CSP does not
 * apply (ADR-0035); `serializeJsonLd` escapes `<` so content cannot close the tag.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
