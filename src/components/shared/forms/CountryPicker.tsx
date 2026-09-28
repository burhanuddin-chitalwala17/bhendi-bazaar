"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import {
  countryName,
  filterCountries,
  type CountryCode,
} from "@server/shared/countries";

interface CountryPickerProps {
  value: string | null | undefined;
  onChange: (code: CountryCode | null) => void;
  /** What the empty choice is called on this form. */
  blankLabel?: string;
  disabled?: boolean;
}

/**
 * One searchable country field for every form that asks for one: the button names the choice and
 * the list opens against it — a popover on a wide screen, a sheet on a phone
 * ([ADR-0040](../../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)).
 * A native select of 249 rows is a scroll either way; typing three letters is not. Stores the
 * code, shows the name.
 */
export function CountryPicker({
  value,
  onChange,
  blankLabel = "Not set",
  disabled = false,
}: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = filterCountries(query);

  const pick = (code: CountryCode | null) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <ResponsivePicker
      open={open}
      onOpenChange={(next) =>
        next ? setOpen(true) : pick(value ? (value as CountryCode) : null)
      }
      title="Country"
      description="Type a few letters to find it."
      className="w-80"
      trigger={
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={value ? "" : "text-muted-foreground"}>
            {value ? countryName(value) : blankLabel}
          </span>
          <ChevronsUpDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </Button>
      }
    >
      <div className="space-y-3">
        <Input
          autoFocus
          type="search"
          inputMode="search"
          autoComplete="off"
          placeholder="Search countries"
          aria-label="Search countries"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              pick(results[0].code);
            }
          }}
        />
        <ul role="listbox" aria-label="Countries" className="space-y-0.5">
          {!query && (
            <li role="option" aria-selected={!value}>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between font-normal"
                onClick={() => pick(null)}
              >
                <span className="text-muted-foreground">{blankLabel}</span>
                {!value && <Check className="size-4" aria-hidden />}
              </Button>
            </li>
          )}
          {results.map((option) => (
            <li
              key={option.code}
              role="option"
              aria-selected={option.code === value}
            >
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-between font-normal"
                onClick={() => pick(option.code)}
              >
                <span>{option.name}</span>
                {option.code === value && (
                  <Check className="size-4" aria-hidden />
                )}
              </Button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="py-6 text-center text-sm text-muted-foreground">
              No country matches “{query}”.
            </li>
          )}
        </ul>
      </div>
    </ResponsivePicker>
  );
}
