"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { countryName, filterCountries, type CountryCode } from "@server/shared/countries";

interface CountryPickerProps {
  value: string | null | undefined;
  onChange: (code: CountryCode | null) => void;
  /** What the empty choice is called on this form. */
  blankLabel?: string;
  disabled?: boolean;
}

/**
 * One searchable country field for every form that asks for one: a button that names the
 * choice, and a sheet with a search box over the ISO list. A native select of 249 rows is a
 * scroll on a phone; typing three letters is not. Stores the code, shows the name.
 */
export function CountryPicker({ value, onChange, blankLabel = "Not set", disabled = false }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = filterCountries(query);

  const pick = (code: CountryCode | null) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full justify-between font-normal"
      >
        <span className={value ? "" : "text-muted-foreground"}>{value ? countryName(value) : blankLabel}</span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : pick(value ? (value as CountryCode) : null))}>
        <SheetContent side="adaptive">
          <SheetTitle>Country</SheetTitle>
          <SheetDescription>Type a few letters to find it.</SheetDescription>
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
                <Button type="button" variant="ghost" className="w-full justify-between font-normal" onClick={() => pick(null)}>
                  <span className="text-muted-foreground">{blankLabel}</span>
                  {!value && <Check className="size-4" aria-hidden />}
                </Button>
              </li>
            )}
            {results.map((option) => (
              <li key={option.code} role="option" aria-selected={option.code === value}>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-between font-normal"
                  onClick={() => pick(option.code)}
                >
                  <span>{option.name}</span>
                  {option.code === value && <Check className="size-4" aria-hidden />}
                </Button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">No country matches “{query}”.</li>
            )}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
