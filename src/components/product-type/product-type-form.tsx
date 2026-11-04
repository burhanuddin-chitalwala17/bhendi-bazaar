"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";

import { Button } from "@/components/ui/button";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared/forms/FormField";
import { Checkbox } from "@/components/ui/checkbox";
import { ApiError } from "@/lib/api-error";
import { productTypeApiClient } from "@/components/product-type/productTypeApiClient";
import {
  FACTS,
  FACT_DECLARATIONS,
  MEASURES,
  UNITS,
  type FactKey,
  type MeasureKey,
} from "@server/listing/listing-facts";
import type { ProductTypeRecord } from "@server/listing/product-type.types";

/**
 * Building a question set.
 *
 * Choosing which facts a product line needs is a design decision, not data entry
 * ([product-types](../../../docs/specs/listing-vocabulary/product-types/) R7), so every fact
 * shows which marketplaces mark it compulsory — measured from their own templates. The screen
 * refuses nothing on that basis: a type we would not have built may be a line we have not met.
 *
 * Mobile-first ([ADR-0015](../../../docs/adr/0015-mobile-first-design.md)): one column of
 * grouped checkboxes at base, two from `md` up. No grid at phone width, and no control under
 * 40px.
 */
export function ProductTypeForm({ type }: { type?: ProductTypeRecord }) {
  const router = useRouter();
  const isEdit = !!type;

  const [key, setKey] = useState(type?.key ?? "");
  const [label, setLabel] = useState(type?.label ?? "");
  const [facts, setFacts] = useState<FactKey[]>([...(type?.facts ?? [])]);
  const [measures, setMeasures] = useState<MeasureKey[]>(
    (type?.measures ?? []).map((m) => m.key),
  );
  const [units, setUnits] = useState<Record<string, string>>(
    Object.fromEntries((type?.measures ?? []).map((m) => [m.key, m.unit])),
  );
  const [required, setRequired] = useState<string[]>(
    (type?.measures ?? []).filter((m) => m.required).map((m) => m.key),
  );
  const [axis, setAxis] = useState<string[]>([...(type?.variantAxis ?? [])]);
  const [kinds, setKinds] = useState(
    (type?.kinds ?? []).map((k) => `${k.key}:${k.label}`).join("\n"),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /** Only what the type asks about can be an axis — the server refuses the rest anyway. */
  const axisCandidates = useMemo(
    () => [...facts, ...measures] as string[],
    [facts, measures],
  );

  const toggle = <T extends string>(list: T[], value: T, set: (next: T[]) => void) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        label,
        facts,
        measures: measures.map((m) => ({
          key: m,
          label: m.charAt(0).toUpperCase() + m.slice(1),
          unit: (units[m] ?? "cm") as (typeof UNITS)[number],
          required: required.includes(m),
        })),
        variantAxis: axis.filter((a) => axisCandidates.includes(a)),
        kinds: kinds
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [k, ...rest] = line.split(":");
            return { key: k.trim(), label: (rest.join(":") || k).trim() };
          }),
        factLabels: Object.fromEntries(
          Object.entries(type?.factLabels ?? {}).filter(([fact]) => facts.includes(fact as FactKey)),
        ),
        labelFrom: (type?.labelFrom ?? []).filter((m) => measures.includes(m)),
        labelScale: type?.labelScale ?? null,
        order: 0,
      };

      if (isEdit) {
        await productTypeApiClient.update(type.key, payload);
      } else {
        await productTypeApiClient.create({ ...payload, key });
      }
      router.push("/admin/product-types");
      router.refresh();
    } catch (caught) {
      // The action stays enabled and the click explains why it could not proceed, rather than a
      // disabled button that says nothing.
      setError(
        caught instanceof ApiError ? caught.message : "Could not save the product type",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-field border border-destructive/30 bg-destructive/10 p-3 text-small text-destructive"
        >
          <Icon name="error" className="mt-0.5" />
          {error}
        </p>
      )}

      <section className="rounded-card border border-border bg-card p-4 md:p-6">
        <h2 className="mb-4 text-title font-semibold text-foreground">What it is</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormInput
            label="Name"
            required
            placeholder="e.g. Islamic wear"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            hint="What an admin picks it by"
          />
          <FormInput
            label="Key"
            required
            placeholder="e.g. islamic-wear"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={isEdit}
            hint={
              isEdit
                ? "Frozen after creation — products and categories store it"
                : "Lowercase letters, digits and hyphens. It cannot be changed later."
            }
          />
        </div>
      </section>

      <section className="rounded-card border border-border bg-card p-4 md:p-6">
        <h2 className="text-title font-semibold text-foreground">What it asks</h2>
        <p className="mb-4 mt-1 text-small text-muted-foreground">
          Each line says which marketplaces mark it compulsory somewhere. Leaving one out is
          allowed; it means a listing there will be refused until it is answered.
        </p>
        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {FACTS.map((fact) => {
            const declaration = FACT_DECLARATIONS[fact];
            return (
              <li key={fact} className="rounded-field p-2 hover:bg-muted">
                <Checkbox
                  label={declaration.label}
                  description={
                    declaration.requiredBy.length > 0
                      ? `Required by ${declaration.requiredBy.join(", ")}`
                      : "Required by nobody — useful on your own storefront"
                  }
                  checked={facts.includes(fact)}
                  onChange={() => toggle(facts, fact, setFacts)}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-card border border-border bg-card p-4 md:p-6">
        <h2 className="text-title font-semibold text-foreground">What it measures</h2>
        <p className="mb-4 mt-1 text-small text-muted-foreground">
          The unit is fixed for the type, never chosen per product — a free unit is how
          centimetres and inches end up in one column.
        </p>
        <ul className="space-y-2">
          {MEASURES.map((measure) => (
            <li key={measure} className="flex flex-wrap items-end gap-3 rounded-field p-2">
              <div className="min-w-40">
                <Checkbox
                  label={measure}
                  checked={measures.includes(measure)}
                  onChange={() => toggle(measures, measure, setMeasures)}
                />
              </div>
              {measures.includes(measure) && (
                <>
                  <FormSelect
                    label={`Unit for ${measure}`}
                    value={units[measure] ?? "cm"}
                    onChange={(e) => setUnits({ ...units, [measure]: e.target.value })}
                  >
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </FormSelect>
                  <div className="pb-2">
                    <Checkbox
                      label="Required"
                      checked={required.includes(measure)}
                      onChange={() => toggle(required, measure, setRequired)}
                    />
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-card border border-border bg-card p-4 md:p-6">
        <h2 className="text-title font-semibold text-foreground">What makes two sell separately</h2>
        <p className="mb-4 mt-1 text-small text-muted-foreground">
          Only something the type asks about. An abaya varies by colour; an attar by its bottle
          size.
        </p>
        {axisCandidates.length === 0 ? (
          <p className="text-small text-muted-foreground">Choose a question or a measurement first.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {axisCandidates.map((candidate) => (
              <li key={candidate} className="rounded-field p-2 hover:bg-muted">
                <Checkbox
                  label={candidate}
                  checked={axis.includes(candidate)}
                  onChange={() => toggle(axis, candidate, setAxis)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card border border-border bg-card p-4 md:p-6">
        <h2 className="text-title font-semibold text-foreground">The kinds it holds</h2>
        <p className="mb-4 mt-1 text-small text-muted-foreground">
          One per line, as <code>key:Label</code>. A kind decides which category a marketplace
          lists it under — abaya, burqa and rida are kinds, not types of their own.
        </p>
        <FormTextarea
          label="Kinds"
          rows={5}
          placeholder={"abaya:Abaya\nrida:Rida"}
          value={kinds}
          onChange={(e) => setKinds(e.target.value)}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" pending={saving}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create type"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
