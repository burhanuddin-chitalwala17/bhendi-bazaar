"use client";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/shared/forms/FormField";
import { FEE_COPY } from "./fee-copy";
import { useFeeForm } from "./useFeeForm";

/** ux.md "admin fee setting": one field, whole rupees. Never disabled (R15). */
export function FeeForm({ feeRupees, version, lastChanged }: { feeRupees: number; version: number; lastChanged: string | null }) {
  const { form, submit, refresh } = useFeeForm({ feeRupees, version });
  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <FormInput
        type="number"
        inputMode="numeric"
        min={0}
        max={1000}
        step={1}
        label={FEE_COPY.label}
        hint={FEE_COPY.hint}
        error={form.formState.errors.feeRupees?.message}
        {...form.register("feeRupees", { valueAsNumber: true })}
      />
      {lastChanged && <p className="text-small text-muted-foreground">{lastChanged}</p>}
      {form.formError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-small text-destructive">
          <span className="break-words">{form.formError}</span>
          <Button type="button" size="sm" variant="outline" className="min-h-10" onClick={refresh}>
            {FEE_COPY.refresh}
          </Button>
        </div>
      )}
      <Button type="submit" className="min-h-11" pending={form.isSubmitting}>
        {form.isSubmitting ? FEE_COPY.saving : FEE_COPY.save}
      </Button>
    </form>
  );
}
