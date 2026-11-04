import { useCallback, useEffect, useState } from "react";

import { shippingApiClient } from "@/components/shipping/shippingApiClient";
import { useMutation } from "@/hooks/core/useMutation";
import { ApiError } from "@/lib/api-error";

/** An Indian PIN code: six digits, never starting with 0. Anything else is refused before a request. */
export const isPincode = (value: string) => /^[1-9]\d{5}$/.test(value);

/** Per viewer, a convenience only: a private window or blocked storage just asks again. */
const PINCODE_KEY = "bb:delivery-pincode";

export type DeliveryAnswer =
  | { kind: "delivers"; pincode: string; days: number }
  | { kind: "no-service"; pincode: string };

function readSaved(): string | null {
  try {
    const saved = window.localStorage.getItem(PINCODE_KEY);
    return saved && isPincode(saved) ? saved : null;
  } catch {
    return null;
  }
}

function save(pincode: string) {
  try {
    window.localStorage.setItem(PINCODE_KEY, pincode);
  } catch {
    // Storage refused: the answer still shows, it just isn't remembered.
  }
}

/**
 * Whether a product reaches a PIN code and roughly when (design-system Q25), on the same rates
 * lookup checkout uses. The estimate is the courier's; checkout quotes the real price.
 */
export function useDeliveryCheck({ fromPincode, weight }: { fromPincode: string; weight: number }) {
  const [answer, setAnswer] = useState<DeliveryAnswer | null>(null);

  const lookup = useCallback(
    async (toPincode: string): Promise<DeliveryAnswer> => {
      try {
        const { rates } = await shippingApiClient.getRates({ fromPincode, toPincode, weight: weight > 0 ? weight : undefined });
        if (rates.length === 0) return { kind: "no-service", pincode: toPincode };
        return { kind: "delivers", pincode: toPincode, days: Math.min(...rates.map((rate) => rate.estimatedDays)) };
      } catch (error) {
        // The route answers 404 when no courier serves the pair: an answer, not a failure.
        if (error instanceof ApiError && error.status === 404) return { kind: "no-service", pincode: toPincode };
        throw error;
      }
    },
    [fromPincode, weight],
  );

  const { mutate, isLoading, error } = useMutation(lookup, { showToast: false });

  const check = useCallback(
    async (pincode: string) => {
      if (!isPincode(pincode)) return;
      const result = await mutate(pincode).catch(() => null);
      if (result) {
        setAnswer(result);
        save(pincode);
      }
    },
    [mutate],
  );

  // A pincode remembered from another product is checked for this one, once, after mount.
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    const remembered = readSaved();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects localStorage, an external system
    setSaved(remembered);
    if (remembered) void check(remembered);
  }, [check]);

  return { answer, check, checking: isLoading, failed: error !== null, saved, clear: () => setAnswer(null) };
}
