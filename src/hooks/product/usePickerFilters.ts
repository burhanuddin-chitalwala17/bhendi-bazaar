"use client";

import { useCallback, useState } from "react";
import { NO_PICKER_FILTERS, type PickerFilters } from "@/lib/media/picker-query";

/**
 * The library picker's filters (picker-filters D3, Q2): its own state, never the router's, so the
 * page underneath keeps its address. Held by the picker, which stays mounted while its page is
 * open, so closing and reopening keeps them and a reload resets them.
 */
export function usePickerFilters() {
  const [filters, setFilters] = useState<PickerFilters>(NO_PICKER_FILTERS);
  const clear = useCallback(() => setFilters(NO_PICKER_FILTERS), []);
  return { filters, setFilters, clear };
}
