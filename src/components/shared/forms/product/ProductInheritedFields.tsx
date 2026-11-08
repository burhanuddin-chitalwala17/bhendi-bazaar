"use client";

import { useState } from "react";
import { useWatch, type Control, type UseFormSetValue } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormController } from "../FormField";
import { CountryPicker } from "../CountryPicker";
import type { ProductFormInput } from "@/components/product/console/types";
import type { BrandDto } from "@server/catalog/brand.types";
import { countryName } from "@server/shared/countries";
import { INHERITED_ANSWER, INHERITED_ANSWERS, type InheritedAnswer } from "@server/shared/brand-party";
import { inheritedFrom } from "./inherited-answers";
import { PRODUCT_INHERITED_FIELDS_COPY as C } from "./product-copy";

/**
 * Country, maker, packer and importer as the product's brand fills them, each overridable on this product
 * (listing-model/dynamic-form A4, ux journey 3): "From your brand Noor: …" → Change → "Set on this product".
 */
export function ProductInheritedFields({ control, setValue, brands, shopCountry, errors, readOnly = false }: {
  control: Control<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  brands: readonly BrandDto[];
  shopCountry: string | null;
  /** The save's refusals for these answers, shown on each field. */
  errors?: Partial<Record<string, { message?: string }>>;
  readOnly?: boolean;
}) {
  const brandId = useWatch({ control, name: "brandId" }) as string | null | undefined;
  const facts = (useWatch({ control, name: "facts" }) ?? {}) as Record<string, unknown>;
  const [editing, setEditing] = useState<ReadonlySet<InheritedAnswer>>(new Set());
  const from = inheritedFrom(brands, brandId ?? null, shopCountry);

  const own = (key: InheritedAnswer) => typeof facts[key] === "string" && (facts[key] as string).trim() !== "";
  const revert = (key: InheritedAnswer) => {
    setValue(`facts.${key}` as never, null as never, { shouldDirty: true });
    setEditing((s) => new Set([...s].filter((k) => k !== key)));
  };

  return (
    <fieldset className="space-y-3 rounded-card border border-border p-3">
      <legend className="px-1 text-sm font-medium text-foreground">{C.title}</legend>
      {INHERITED_ANSWERS.map((key) => {
        const label = C.labels[key];
        const inherited = from[key];
        const shown = key === INHERITED_ANSWER.COUNTRY_OF_ORIGIN && inherited.value ? countryName(inherited.value) : inherited.value;
        const fromShop = inherited.level === "shop";
        const source = shown
          ? fromShop ? C.fromShop(shown) : inherited.name ? C.fromBrand(inherited.name, shown) : C.nothingYet
          : inherited.name && !fromShop ? C.brandSilent(inherited.name) : C.nothingYet;
        if (own(key) || editing.has(key)) {
          return (
            <div key={key} className="space-y-1">
              {key === INHERITED_ANSWER.COUNTRY_OF_ORIGIN ? (
                <FormController
                  name={`facts.${key}` as never}
                  control={control}
                  label={label}
                  hint={C.setOnProduct}
                  error={errors?.[key]?.message}
                  render={({ field }) => (
                    <CountryPicker value={typeof field.value === "string" ? field.value : null} onChange={field.onChange} disabled={readOnly} />
                  )}
                />
              ) : (
                <FormController
                  name={`facts.${key}` as never}
                  control={control}
                  label={label}
                  hint={C.setOnProduct}
                  error={errors?.[key]?.message}
                  render={({ field }) => (
                    <Input placeholder={C.partyPlaceholder} disabled={readOnly} value={typeof field.value === "string" ? field.value : ""} onChange={(e) => field.onChange(e.target.value)} />
                  )}
                />
              )}
              {!readOnly && (
                <Button type="button" variant="link" size="sm" className="px-0" onClick={() => revert(key)}>
                  {fromShop ? C.revertToShop : C.revertToBrand}
                </Button>
              )}
            </div>
          );
        }
        return (
          <div key={key} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-small font-medium text-foreground">{label}</p>
              <p className="text-small text-muted-foreground">
                {source}
              </p>
            </div>
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing((s) => new Set([...s, key]))}>
                {C.change}
              </Button>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
