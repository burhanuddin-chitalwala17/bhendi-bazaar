// Canonical Indian PIN code rule. Single declaration on purpose — five copies had
// drifted, and the laxest was on the server, which is the authority.
// First digit is 1-9: no Indian PIN code begins with 0.
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export const PINCODE_MESSAGE = "Enter a 6-digit PIN code (e.g. 400008)";

export function isValidPincode(pincode: string): boolean {
  return PINCODE_PATTERN.test(pincode);
}
