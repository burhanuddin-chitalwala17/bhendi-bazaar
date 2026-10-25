"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SettleTypeDTO } from "@server/channels/channel-facts.types";

import { AskAdminPicker } from "./ask-admin-picker";
import { ASK_ADMIN, FACTS } from "./facts-copy";

/**
 * What a new product is, from the marketplace's own type (marketplace-facts D9, ux.md "Type to
 * confirm", "Category to confirm", "No matching type"): a tap picks the category, whose type the
 * product takes. The category field below stays for any other choice.
 */
export function SettleTypeQuestion({
  label,
  type,
  categoryId,
  message,
  onCategory,
  onPark,
}: {
  label: string;
  type: SettleTypeDTO;
  categoryId: string | undefined;
  message: string;
  onCategory: (id: string) => void;
  onPark: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(type.types.length === 1 && type.kind !== "none" ? type.types[0].key : null);
  const chosen = type.types.find((t) => t.key === picked) ?? null;
  // One category of the mapped type is already chosen below; there is nothing to ask.
  if (type.kind === "mapped" && chosen && chosen.categories.length === 1) return null;

  const intro =
    type.kind === "none" && !chosen
      ? FACTS.noMatchingType(label, type.marketplaceType)
      : chosen
        ? FACTS.categoryToConfirm(label, type.marketplaceType, chosen.label)
        : FACTS.typeToConfirm(label, type.marketplaceType);

  return (
    <div className="flex flex-col gap-2 rounded-card border p-3">
      <p className="text-sm">{intro}</p>
      {type.kind === "none" && !chosen && <p className="text-sm text-muted-foreground">{FACTS.pickOrPark}</p>}
      <div className="flex flex-wrap gap-2">
        {chosen
          ? chosen.categories.map((c) => (
              <Button
                key={c.id}
                type="button"
                variant={categoryId === c.id ? "default" : "outline"}
                size="sm"
                aria-pressed={categoryId === c.id}
                className="h-auto min-h-10 whitespace-normal"
                onClick={() => onCategory(c.id)}
              >
                {c.name}
              </Button>
            ))
          : type.types.map((t) => (
              <Button key={t.key} type="button" variant="outline" size="sm" className="min-h-10" onClick={() => setPicked(t.key)}>
                {t.label}
              </Button>
            ))}
      </div>
      {type.kind === "none" && !chosen && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="min-h-10" onClick={onPark}>
            {ASK_ADMIN.park}
          </Button>
          <AskAdminPicker message={message} />
        </div>
      )}
    </div>
  );
}
