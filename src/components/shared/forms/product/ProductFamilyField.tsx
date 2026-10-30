"use client";

import { useState } from "react";
import type { FieldErrors, UseFormRegister, UseFormSetValue } from "react-hook-form";

import { FormInput, FormSelect } from "../FormField";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-error";
import { listingApiClient } from "@/components/product/listingApiClient";
import type { ProductFormInput } from "@/components/product/console/types";

export interface FamilyOption {
  id: string;
  name: string;
}

/**
 * Which family this product belongs to, and making one without leaving the form
 * ([variants](../../../../../docs/specs/listing-vocabulary/variants/) R2, R6).
 *
 * A family is what an abaya in four colours has in common — the description, the fabric, the
 * measurements. Each colour stays its own product with its own code, price and stock; the family
 * is only what they share.
 *
 * **Most products have none**, and that is the normal case: one abaya in one colour is one
 * product, and nothing asks a shop to declare a family of one. The field offers to start one at
 * the moment a second colour exists, which is when it first earns its keep.
 *
 * Mobile-first ([ADR-0015](../../../../../docs/adr/0015-mobile-first-design.md)): the picker and
 * the create row stack at base, sit side by side from `sm`.
 */
export function ProductFamilyField({
  register,
  setValue,
  errors,
  orgId,
  categoryId,
  families,
  readOnly = false,
}: {
  register: UseFormRegister<ProductFormInput>;
  setValue: UseFormSetValue<ProductFormInput>;
  errors: FieldErrors<ProductFormInput>;
  orgId: string;
  categoryId: string;
  families: FamilyOption[];
  readOnly?: boolean;
}) {
  const [options, setOptions] = useState(families);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate() {
    // Never disabled (product-form A8, ADR-0053): a second tap while creating is ignored, a short name is told why.
    if (busy) return;
    setError(null);
    if (name.trim().length < 2) {
      setError("Name needs 2 or more letters");
      return;
    }
    if (!categoryId) {
      // The family takes its type and its axis from the category, so it cannot be made first.
      setError("Choose a category first — the family takes its questions from it");
      return;
    }
    setBusy(true);
    try {
      const family = await listingApiClient.createFamily(orgId, { name, categoryId });
      setOptions((current) => [...current, { id: family.id, name: family.name }]);
      setValue("familyId", family.id, { shouldDirty: true });
      setCreating(false);
      setName("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not create the family");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FormSelect
        label="Part of a family"
        {...register("familyId")}
        error={errors.familyId?.message}
        disabled={readOnly}
        hint="For the same thing in several colours or sizes. Most products need none."
      >
        <option value="">On its own</option>
        {options.map((family) => (
          <option key={family.id} value={family.id}>
            {family.name}
          </option>
        ))}
      </FormSelect>

      {!readOnly && !creating && (
        <Button type="button" variant="outline" size="sm" onClick={() => setCreating(true)}>
          Start a new family
        </Button>
      )}

      {creating && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormInput
            label="Family name"
            placeholder="e.g. Nida Matte Abaya"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={error ?? undefined}
            hint="What the colours have in common, not one of them"
          />
          <div className="flex gap-2">
            <Button type="button" onClick={onCreate} aria-busy={busy}>
              {busy ? "Creating…" : "Create"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
