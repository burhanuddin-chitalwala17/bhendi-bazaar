"use client";

import { ResourceList } from "@/components/shared/resource-list";
import { formatCount } from "@/lib/format";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * The question sets, with what each one costs to change. The usage counts are the reason the
 * screen exists: editing a type changes what is asked of every product under it. A row opens
 * the type's editor.
 */
export function ProductTypesTable({
  types,
  usage,
}: {
  types: ProductTypeRecord[];
  usage: Record<string, { categories: number; products: number }>;
}) {
  const usedBy = (key: string) =>
    `${formatCount(usage[key]?.categories ?? 0)} categories · ${formatCount(usage[key]?.products ?? 0)} products`;

  return (
    <ResourceList
      label="Product types"
      rows={types}
      rowKey={(type) => type.key}
      rowHref={(type) => `/admin/product-types/${type.key}/edit`}
      empty={{
        title: "No product types yet",
        description:
          "A category with no type asks only the shared questions, and its products cannot be published to a marketplace.",
        action: { label: "New type", href: "/admin/product-types/new" },
      }}
      columns={[
        { key: "label", label: "Type", cell: (type) => type.label, phone: "title" },
        { key: "key", label: "Key", cell: (type) => <span className="font-mono text-muted-foreground">{type.key}</span>, phone: "meta" },
        { key: "questions", label: "Questions", cell: (type) => type.facts.length, align: "end", phone: "meta" },
        { key: "measures", label: "Measurements", cell: (type) => type.measures.length, align: "end", phone: "hidden" },
        { key: "kinds", label: "Kinds", cell: (type) => type.kinds.length, align: "end", phone: "hidden" },
        { key: "usedBy", label: "Used by", cell: (type) => usedBy(type.key) },
      ]}
    />
  );
}
