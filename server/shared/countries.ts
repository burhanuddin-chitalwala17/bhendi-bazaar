/**
 * ISO 3166-1 alpha-2, the code a channel asks a country of origin in. Names come from the
 * runtime's own ICU data through `Intl.DisplayNames`, so no list of names is maintained here
 * and a store in another language would get them in its own.
 */
export const COUNTRY_CODES = [
  "AD","AE","AF","AG","AI","AL","AM","AO","AQ","AR","AS","AT","AU","AW","AX","AZ","BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ","CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CU","CV","CW","CX","CY","CZ","DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR","GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY","HK","HM","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP","KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY","MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ","NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY","QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ","TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ","VA","VC","VE","VG","VI","VN","VU","WF","WS","YE","YT","ZA","ZM","ZW",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

/** The store's home market, offered first in every country list. */
export const HOME_COUNTRY: CountryCode = "IN";

const names = new Intl.DisplayNames(["en"], { type: "region" });

/** "IN" → "India". A code ICU does not know, or a blank, reads back as itself or nothing. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  try {
    return names.of(code) ?? code;
  } catch {
    return code;
  }
}

export function isCountryCode(value: string): value is CountryCode {
  return (COUNTRY_CODES as readonly string[]).includes(value);
}

/** Every country as `{ code, name }`, home market first, the rest by name. */
export function countryOptions(): Array<{ code: CountryCode; name: string }> {
  const rest = COUNTRY_CODES.filter((code) => code !== HOME_COUNTRY)
    .map((code) => ({ code, name: countryName(code) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  return [{ code: HOME_COUNTRY, name: countryName(HOME_COUNTRY) }, ...rest];
}

/** A stored value as a typed code, or null — the form's default from a column typed as text. */
export function asCountryCode(value: string | null | undefined): CountryCode | null {
  return value && isCountryCode(value) ? value : null;
}

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * The countries a typed query means: a name containing it, or its code exactly. Names that
 * start with the query come first, so "in" offers India before Benin. Accents are ignored,
 * so "cote" finds Côte d'Ivoire. An empty query is the whole list in its usual order.
 */
export function filterCountries(query: string): Array<{ code: CountryCode; name: string }> {
  const needle = fold(query);
  const options = countryOptions();
  if (!needle) return options;
  const starts: typeof options = [];
  const contains: typeof options = [];
  for (const option of options) {
    const name = fold(option.name);
    if (name.startsWith(needle) || option.code.toLowerCase() === needle) starts.push(option);
    else if (name.includes(needle)) contains.push(option);
  }
  return [...starts, ...contains];
}
