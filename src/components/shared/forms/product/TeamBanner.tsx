"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { FormInput } from "../FormField";
import type { ProductFormInput } from "@/components/product/console/types";
import { TEAM_BANNER_COPY } from "./product-copy";

/** The Bhendi Bazaar team's form for a shop: whose product it is, and why it is being changed (R10, Q22). */
export function TeamBanner({
  shopName,
  register,
  errors,
}: {
  shopName: string;
  register: UseFormRegister<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
}) {
  return (
    <div role="note" className="space-y-3 rounded-card border border-primary/30 bg-primary/5 p-3">
      <p className="break-words text-sm font-medium text-foreground">
        Editing for {shopName}. The shop will see &lsquo;Edited by Bhendi Bazaar team&rsquo;.
      </p>
      <FormInput label={TEAM_BANNER_COPY.whyAreYouChangingThis} required error={errors.reason?.message} {...register("reason")} />
    </div>
  );
}
