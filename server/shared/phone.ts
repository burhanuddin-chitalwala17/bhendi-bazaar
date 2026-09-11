// What a phone number is, declared once — for pincode.ts's reason: the rule had four
// copies that disagreed. Stored and sent as E.164 (docs/specs/international-phone/trd.md).
import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";

export type { CountryCode };

/** Every number stored before international-phone was Indian, and most buyers still are. */
export const DEFAULT_PHONE_COUNTRY: CountryCode = "IN";

export const PHONE_MESSAGE = "Enter a valid phone number for the selected country";

/** E.164 (`+919876543210`) when valid, else null. A number without `+` is read as `country`'s. */
export function normalizePhone(
  input: string,
  country: CountryCode = DEFAULT_PHONE_COUNTRY
): string | null {
  const parsed = parsePhoneNumberFromString(input, country);
  return parsed?.isValid() ? parsed.number : null;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

/** For display. A value that does not parse is shown as stored rather than hidden. */
export function formatPhone(value: string): string {
  const parsed = parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY);
  return parsed?.isValid() ? parsed.formatInternational() : value;
}

export interface PhoneParts {
  country: CountryCode;
  national: string;
}

/** A stored value split for the country picker and the number field. */
export function splitPhone(value: string): PhoneParts {
  const parsed = value ? parsePhoneNumberFromString(value, DEFAULT_PHONE_COUNTRY) : undefined;
  if (parsed?.country) return { country: parsed.country, national: parsed.nationalNumber };
  return { country: DEFAULT_PHONE_COUNTRY, national: value };
}

/**
 * What the picker and field submit: E.164 even while incomplete (`+91987`), so validation
 * judges the number against the country on screen instead of failing on its spelling.
 */
export function joinPhone({ country, national }: PhoneParts): string {
  const digits = national.replace(/\D/g, "");
  if (digits === "") return "";
  return (
    parsePhoneNumberFromString(national, country)?.number ??
    `+${getCountryCallingCode(country)}${digits}`
  );
}

export function callingCodeOf(country: CountryCode): string {
  return getCountryCallingCode(country);
}

export function isPhoneCountry(value: string): value is CountryCode {
  return isSupportedCountry(value);
}

export const PHONE_COUNTRIES: readonly { code: CountryCode; callingCode: string }[] =
  getCountries().map((code) => ({ code, callingCode: getCountryCallingCode(code) }));
