/**
 * Pincode Validator Utility
 * 
 * Validates Indian pincodes and provides utility functions.
 */

/**
 * Validate Indian pincode format
 */
import { isValidPincode } from "@server/shared/pincode";
export { isValidPincode };

/**
 * Normalize pincode (remove spaces, ensure 6 digits)
 */
export function normalizePincode(pincode: string): string {
  return pincode.replace(/\s/g, "");
}

/**
 * Get state from pincode (first digit indicates region)
 */
export function getPincodeRegion(pincode: string): string | null {
  if (!isValidPincode(pincode)) return null;

  const firstDigit = pincode[0];
  const regions: Record<string, string> = {
    "1": "Delhi, Haryana, Punjab, Himachal Pradesh, Jammu & Kashmir",
    "2": "Uttar Pradesh, Uttarakhand",
    "3": "Rajasthan, Gujarat, Dadra & Nagar Haveli, Daman & Diu",
    "4": "Maharashtra, Goa, Madhya Pradesh, Chhattisgarh",
    "5": "Andhra Pradesh, Telangana, Karnataka",
    "6": "Tamil Nadu, Kerala, Puducherry, Lakshadweep",
    "7": "West Bengal, Odisha, Assam, Northeast States",
    "8": "Bihar, Jharkhand",
    "9": "Andaman & Nicobar Islands (not commonly used for mainland)",
  };

  return regions[firstDigit] || "Unknown";
}

/**
 * Calculate distance category between pincodes (approximate)
 */
export function estimateDistanceCategory(
  fromPincode: string,
  toPincode: string
): "local" | "regional" | "national" {
  if (!isValidPincode(fromPincode) || !isValidPincode(toPincode)) {
    return "national";
  }

  const from = normalizePincode(fromPincode);
  const to = normalizePincode(toPincode);

  // Same first 2 digits = local (within ~100km)
  if (from.substring(0, 2) === to.substring(0, 2)) {
    return "local";
  }

  // Same first digit = regional (within ~500km)
  if (from[0] === to[0]) {
    return "regional";
  }

  // Different first digit = national
  return "national";
}


