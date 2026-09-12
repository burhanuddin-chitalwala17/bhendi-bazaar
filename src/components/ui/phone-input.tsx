"use client";

import { useMemo, useState, type Ref } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PHONE_COUNTRIES,
  callingCodeOf,
  isPhoneCountry,
  isValidPhone,
  joinPhone,
  splitPhone,
  type PhoneParts,
} from "@server/shared/phone";

interface PhoneInputProps {
  /** E.164, a legacy bare Indian number, or "". */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * A country picker and number field that emit one E.164 value. The picker is a native
 * select laid transparently over its label, so a phone opens its own OS picker.
 */
export function PhoneInput({
  value,
  onChange,
  onBlur,
  id,
  name,
  placeholder,
  disabled,
  ref,
  ...aria
}: PhoneInputProps) {
  const [parts, setParts] = useState(() => splitPhone(value));
  // A `value` other than our own last emission came from outside (a reset, a restored
  // draft) and re-seeds. Our echo must not, or re-splitting would eat a typed trunk 0.
  const [emitted, setEmitted] = useState(value);
  if (value !== emitted) {
    setEmitted(value);
    setParts(splitPhone(value));
  }

  const options = useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return PHONE_COUNTRIES.map((country) => ({
      ...country,
      name: names.of(country.code) ?? country.code,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const emit = (next: PhoneParts) => {
    const joined = joinPhone(next);
    setParts(next);
    setEmitted(joined);
    onChange(joined);
  };

  const changeNumber = (typed: string) => {
    // Autofill and paste deliver the whole international number; take its country from it.
    const international = typed.trimStart().startsWith("+") && isValidPhone(typed);
    emit(international ? splitPhone(typed) : { country: parts.country, national: typed });
  };

  const changeCountry = (code: string) => {
    if (isPhoneCountry(code)) emit({ country: code, national: parts.national });
  };

  return (
    <div className="flex gap-2">
      <div
        className={cn(
          "relative flex h-9 shrink-0 items-center gap-1 rounded-field border border-input px-2 text-base shadow-inset-field md:text-sm",
          "has-[select:focus-visible]:border-ring has-[select:focus-visible]:ring-[3px] has-[select:focus-visible]:ring-ring/50",
          disabled && "opacity-50"
        )}
      >
        <span aria-hidden="true" className="tabular-nums">
          {parts.country} +{callingCodeOf(parts.country)}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
        <select
          aria-label="Country code"
          value={parts.country}
          disabled={disabled}
          onChange={(event) => changeCountry(event.target.value)}
          onBlur={onBlur}
          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
        >
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name} (+{option.callingCode})
            </option>
          ))}
        </select>
      </div>
      <Input
        ref={ref}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={parts.national}
        onChange={(event) => changeNumber(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
        {...aria}
      />
    </div>
  );
}
