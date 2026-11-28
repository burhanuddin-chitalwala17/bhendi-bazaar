import { useEffect, useState } from "react";

import { FIELD_FILTER, type FieldFilter, type FilterChip } from "@server/listing/form-channels";

/** Which filter chip is picked; falls back to All when the picked chip leaves (a new type asks other things). */
export function useFieldFilter(chips: readonly FilterChip[]) {
  const [picked, setPicked] = useState<FieldFilter>(FIELD_FILTER.ALL);
  const found = chips.find((chip) => chip.key === picked);
  // A chip that leaves is forgotten, so it never comes back picked without a tap.
  useEffect(() => {
    if (!found && picked !== FIELD_FILTER.ALL) setPicked(FIELD_FILTER.ALL);
  }, [found, picked]);
  const active = found ?? chips[0];
  return { active, pick: setPicked };
}
