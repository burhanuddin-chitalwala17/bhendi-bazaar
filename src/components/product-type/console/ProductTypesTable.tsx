"use client";

import { ResourceList } from "@/components/shared/resource-list";
import { formatCount } from "@/lib/format";
import type { ProductTypeRecord } from "@server/listing/product-type.types";
import { PRODUCT_TYPES_TABLE_COPY } from "../product-type-copy";
import { ROUTES } from "@server/shared/routes";

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
  const usedBy = (key: string) => {
    return PRODUCT_TYPES_TABLE_COPY.usedBy(formatCount(usage[key]?.categories ?? 0), formatCount(usage[key]?.products ?? 0));
  };

  return (
    <ResourceList
      label={PRODUCT_TYPES_TABLE_COPY.label}
      rows={types}
      rowKey={(type) => type.key}
      rowHref={(type) => ROUTES.admin.editProductType(type.key)}
      empty={{
        title: PRODUCT_TYPES_TABLE_COPY.emptyTitle,
        description: PRODUCT_TYPES_TABLE_COPY.emptyDescription,
        action: { label: PRODUCT_TYPES_TABLE_COPY.newType, href: ROUTES.admin.newProductType },
      }}
      columns={[
        { key: "label", label: PRODUCT_TYPES_TABLE_COPY.type, cell: (type) => type.label, phone: "title" },
        { key: "key", label: PRODUCT_TYPES_TABLE_COPY.key, cell: (type) => <span className="font-mono text-muted-foreground">{type.key}</span>, phone: "meta" },
        { key: "questions", label: PRODUCT_TYPES_TABLE_COPY.questions, cell: (type) => type.facts.length, align: "end", phone: "meta" },
        { key: "measures", label: PRODUCT_TYPES_TABLE_COPY.measures, cell: (type) => type.measures.length, align: "end", phone: "hidden" },
        { key: "kinds", label: PRODUCT_TYPES_TABLE_COPY.kinds, cell: (type) => type.kinds.length, align: "end", phone: "hidden" },
        { key: "usedBy", label: PRODUCT_TYPES_TABLE_COPY.usedByColumn, cell: (type) => usedBy(type.key) },
      ]}
    />
  );
}
