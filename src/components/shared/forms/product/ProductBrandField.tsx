"use client";

import Link from "next/link";
import type { FieldErrors, UseFormRegister } from "react-hook-form";

import { FormSelect } from "../FormField";
import type { ProductFormInput } from "@/components/product/console/types";
import { ROUTES } from "@server/shared/routes";

import { PRODUCT_BRAND_FIELD_COPY as C } from "./product-copy";

/** The anchor a "Choose a brand" link lands on (marketplace-publish Q24). */
export const BRAND_FIELD_ID = "field-brandId";

/**
 * Which of the shop's brands this product is (org-profile R3). Its maker, packer and origin come from
 * the brand, which is what a marketplace's brand complaints ask for. None set: the shop's default brand.
 */
export function ProductBrandField({
  register,
  errors,
  brands,
  orgId,
  readOnly = false,
}: {
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  brands: Array<{ id: string; name: string }>;
  orgId: string;
  readOnly?: boolean;
}) {
  return (
    <div id={BRAND_FIELD_ID} className="scroll-mt-24 space-y-1">
      <FormSelect label={C.label} {...register("brandId")} error={errors.brandId?.message} disabled={readOnly} hint={brands.length === 0 ? undefined : C.hint}>
        <option value="">{C.none}</option>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>{brand.name}</option>
        ))}
      </FormSelect>
      {brands.length === 0 && orgId && (
        <p className="text-small text-muted-foreground">
          {C.noBrands}{" "}
          <Link href={ROUTES.org.listing(orgId)} className="underline underline-offset-4">{C.addBrand}</Link>
        </p>
      )}
    </div>
  );
}
