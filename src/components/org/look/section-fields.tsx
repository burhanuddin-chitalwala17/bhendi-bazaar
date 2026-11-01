"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CLAIMS_REFUSED, type OpeningHoursInput } from "@/lib/validation/schemas/storefront.schema";
import type { StorefrontSettingsDto } from "@server/catalog/storefront.types";
import type { ClaimKey } from "@server/catalog/storefront-claims";
import { CLAIM_DETAIL_MAX, MAX_CLAIMS } from "@server/catalog/storefront-claims";
import { WEEKDAYS } from "@server/catalog/storefront-hours";
import { COLLECTIONS_MAX } from "@server/catalog/storefront-themes";
import { COUNTER_FROM, SEARCH_CATEGORIES_FROM, SECTION_COPY } from "./section-copy";
import { SlotPhotos } from "./slot-photos";

/** ux.md section sheet, Long content: "112 / 120" from 80% of the limit. */
export function Counter({ length, max }: { length: number; max: number }) {
  if (length < max * COUNTER_FROM) return null;
  return (
    <span className={length > max ? "text-destructive" : "text-muted-foreground"} aria-live="polite">
      {length} / {max}
    </span>
  );
}

/** A choice from a set, pressed or not; never disabled, so a refused pick can say why on tap. */
function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={pressed ? "default" : "outline"} aria-pressed={pressed} className="min-h-11 justify-start" onClick={onClick}>
      {pressed && <Check aria-hidden />}
      {children}
    </Button>
  );
}

type Claims = StorefrontSettingsDto["claims"];

/** "Why buy from us": up to three from the shop's own list, each with an optional line (Q21). */
export function ClaimsField({
  options,
  value,
  onChange,
  error,
}: {
  options: StorefrontSettingsDto["claimOptions"];
  value: Claims;
  onChange: (claims: Claims) => void;
  error?: string;
}) {
  const [refused, setRefused] = useState(false);
  const toggle = (key: ClaimKey) => {
    if (value.some((c) => c.key === key)) {
      setRefused(false);
      onChange(value.filter((c) => c.key !== key));
    } else if (value.length >= MAX_CLAIMS) {
      setRefused(true);
    } else {
      onChange([...value, { key, detail: null }]);
    }
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm text-muted-foreground">{SECTION_COPY.claimsHelp}</legend>
      <div className="grid gap-2">
        {options.map((option) => {
          const chosen = value.find((c) => c.key === option.key);
          return (
            <div key={option.key} className="space-y-1">
              <Choice pressed={Boolean(chosen)} onClick={() => toggle(option.key)}>
                {option.label}
              </Choice>
              {chosen && (
                <div className="space-y-1 pl-2">
                  <Input
                    aria-label={`${option.label}: ${SECTION_COPY.claimDetail}`}
                    placeholder={SECTION_COPY.claimDetail}
                    value={chosen.detail ?? ""}
                    onChange={(e) =>
                      onChange(value.map((c) => (c.key === option.key ? { ...c, detail: e.target.value } : c)))
                    }
                  />
                  <p className="text-right text-2xs">
                    <Counter length={chosen.detail?.length ?? 0} max={CLAIM_DETAIL_MAX} />
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(refused || error) && (
        <p role="alert" className="text-sm text-destructive">
          {refused ? CLAIMS_REFUSED : error}
        </p>
      )}
    </fieldset>
  );
}

type Collections = StorefrontSettingsDto["collections"];

/** Up to six of the shop's categories, each with an optional photo (Q10); search past eight. */
export function CollectionsField({
  orgId,
  options,
  value,
  onChange,
  error,
}: {
  orgId: string;
  options: StorefrontSettingsDto["categoryOptions"];
  value: Collections;
  onChange: (collections: Collections) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const [refused, setRefused] = useState(false);
  const shown = options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()));
  const toggle = (categoryId: string) => {
    if (value.some((c) => c.categoryId === categoryId)) {
      setRefused(false);
      onChange(value.filter((c) => c.categoryId !== categoryId));
    } else if (value.length >= COLLECTIONS_MAX) {
      setRefused(true);
    } else {
      onChange([...value, { categoryId, photoUrl: null }]);
    }
  };
  if (!options.length) return <p className="text-sm text-muted-foreground">{SECTION_COPY.noCategories}</p>;
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm text-muted-foreground">{SECTION_COPY.collectionsHelp}</legend>
      {options.length > SEARCH_CATEGORIES_FROM && (
        <Input
          type="search"
          aria-label={SECTION_COPY.searchCategories}
          placeholder={SECTION_COPY.searchCategories}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      <div className="grid gap-2">
        {shown.map((option) => {
          const chosen = value.find((c) => c.categoryId === option.id);
          return (
            <div key={option.id} className="space-y-2">
              <Choice pressed={Boolean(chosen)} onClick={() => toggle(option.id)}>
                {option.name}
              </Choice>
              {chosen && (
                <div className="pl-2">
                  <SlotPhotos
                    orgId={orgId}
                    label={option.name}
                    max={1}
                    value={chosen.photoUrl ? [chosen.photoUrl] : []}
                    onChange={(urls) =>
                      onChange(value.map((c) => (c.categoryId === option.id ? { ...c, photoUrl: urls[0] ?? null } : c)))
                    }
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {(refused || error) && (
        <p role="alert" className="text-sm text-destructive">
          {refused ? `Up to ${COLLECTIONS_MAX}. Remove one to add this.` : error}
        </p>
      )}
    </fieldset>
  );
}

const DEFAULT_HOURS: OpeningHoursInput = { open: "10:00", close: "21:00", closedDays: [] };

/** One opening and closing time and the days the shop is shut (Q45). */
export function HoursField({
  value,
  onChange,
  error,
}: {
  value: OpeningHoursInput | null;
  onChange: (hours: OpeningHoursInput | null) => void;
  error?: string;
}) {
  if (!value) {
    return (
      <Button type="button" variant="outline" className="min-h-11" onClick={() => onChange(DEFAULT_HOURS)}>
        {SECTION_COPY.addHours}
      </Button>
    );
  }
  const toggleDay = (day: number) =>
    onChange({
      ...value,
      closedDays: value.closedDays.includes(day) ? value.closedDays.filter((d) => d !== day) : [...value.closedDays, day].sort(),
    });
  return (
    <fieldset className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="hours-open">{SECTION_COPY.hoursOpen}</Label>
          <Input id="hours-open" type="time" value={value.open} onChange={(e) => onChange({ ...value, open: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hours-close">{SECTION_COPY.hoursClose}</Label>
          <Input id="hours-close" type="time" value={value.close} onChange={(e) => onChange({ ...value, close: e.target.value })} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{SECTION_COPY.hoursClosedOn}</p>
        <div className="flex flex-wrap gap-1">
          {WEEKDAYS.map((day, index) => (
            <Choice key={day} pressed={value.closedDays.includes(index)} onClick={() => toggleDay(index)}>
              {day}
            </Choice>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="button" variant="ghost" className="min-h-11" onClick={() => onChange(null)}>
        {SECTION_COPY.clearHours}
      </Button>
    </fieldset>
  );
}

/** "Hide this section" (Q9), on the sections made only of the shop's own words and picks. */
export function HideField({ hidden, onChange }: { hidden: boolean; onChange: (hidden: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-field border border-border p-3">
      <Label htmlFor="hide-section">{SECTION_COPY.hide}</Label>
      <Switch id="hide-section" checked={hidden} onCheckedChange={onChange} />
    </div>
  );
}
