/** Words for forms/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** AddressFields.tsx */
export const ADDRESS_FIELDS_COPY = {
  label: "Label",
  homeOfficeOther: "Home, Office, Other.",
  fullName: "Full Name",
  yourFullName: "Your full name",
  mobile: "Mobile",
  mobileNumber: "Mobile number",
  email: "Email",
  yourEmailCom: "your@email.com",
  addressLine1: "Address Line 1",
  flatHouseNoBuilding: "Flat, house no., building",
  addressLine2: "Address Line 2",
  areaStreetOptional: "Area, street (optional)",
  city: "City",
  state: "State",
  pinCode: "PIN Code",
  country: "Country",
  notesForTheBazaar: "Notes for the Bazaar",
  anySpecialInstructions: "Any special instructions...",
  optional: "Optional",
} as const;

/** CountryPicker.tsx */
export const COUNTRY_PICKER_COPY = {
  country: "Country",
  typeAFewLettersTo: "Type a few letters to find it.",
  searchCountries: "Search countries",
  countries: "Countries",
  blank: "Not set",
} as const;

/** date-range-field.tsx */
export const DATE_RANGE_FIELD_COPY = {
  when: "When",
  tapTheFirstDayThen: "Tap the first day, then the last. A preset picks both.",
  anyTime: "Any time",
  nothing: "Nothing picked",
  oneDay: "Just this day",
  apply: "Apply",
} as const;

export const ADDRESS_FIELDS_HINT_COPY = {
  emailRequired: "For your order confirmation",
  emailOptional: "Optional - for order updates",
} as const;
