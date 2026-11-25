import { useEffect, useState } from "react";

/** True once `on` has held for `delayMs`, false the moment it drops: a spinner for slow work only. */
export function useDelayedFlag(on: boolean, delayMs: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) return setLate(false);
    const timer = setTimeout(() => setLate(true), delayMs);
    return () => clearTimeout(timer);
  }, [on, delayMs]);
  return on && late;
}
