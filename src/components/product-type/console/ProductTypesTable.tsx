"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * The question sets, with what each one costs to change.
 *
 * `"use client"` is earned by nothing here yet — but the retire control lands next to the edit
 * link, so the boundary is drawn around the row rather than moved later. The counts are the
 * reason the screen exists: editing a type changes what is asked of every product under it.
 *
 * Mobile-first ([ADR-0015](../../../../docs/adr/0015-mobile-first-design.md)): a stacked card per
 * type at base, a table from `md` up. A dense admin table that reflows is unreadable; one that
 * scrolls sideways on a phone is worse.
 */
export function ProductTypesTable({
  types,
  usage,
}: {
  types: ProductTypeRecord[];
  usage: Record<string, { categories: number; products: number }>;
}) {
  if (types.length === 0) {
    return (
      <p className="rounded-card border border-border bg-card p-6 text-sm text-muted-foreground">
        No product types yet. A category with no type asks only the shared questions, and its
        products cannot be published to a marketplace.
      </p>
    );
  }

  return (
    <div className="space-y-3 md:space-y-0">
      {/* Phone: one card per type. */}
      <ul className="space-y-3 md:hidden">
        {types.map((type) => (
          <li key={type.key} className="rounded-card border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{type.label}</p>
                <p className="truncate text-2xs text-muted-foreground">{type.key}</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/admin/product-types/${type.key}/edit`}>
                  <Pencil className="size-4" />
                  <span className="sr-only">Edit {type.label}</span>
                </Link>
              </Button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <Pair label="Questions" value={type.facts.length} />
              <Pair label="Measurements" value={type.measures.length} />
              <Pair label="Kinds" value={type.kinds.length} />
              <Pair label="Used by" value={`${usage[type.key]?.categories ?? 0} categories · ${usage[type.key]?.products ?? 0} products`} />
            </dl>
          </li>
        ))}
      </ul>

      {/* Desktop: the same rows as a table. */}
      <div className="hidden overflow-x-auto rounded-card border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Questions</th>
              <th className="px-4 py-3 font-medium">Measurements</th>
              <th className="px-4 py-3 font-medium">Kinds</th>
              <th className="px-4 py-3 font-medium">Used by</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.key} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{type.label}</div>
                  <div className="text-2xs text-muted-foreground">{type.key}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{type.facts.length}</td>
                <td className="px-4 py-3 text-muted-foreground">{type.measures.length}</td>
                <td className="px-4 py-3 text-muted-foreground">{type.kinds.length}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {usage[type.key]?.categories ?? 0} categories · {usage[type.key]?.products ?? 0} products
                </td>
                <td className="px-4 py-3 text-right">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/product-types/${type.key}/edit`}>
                      <Pencil className="size-4" />
                      <span className="sr-only">Edit {type.label}</span>
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0">
      <dt className="text-3xs uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}
