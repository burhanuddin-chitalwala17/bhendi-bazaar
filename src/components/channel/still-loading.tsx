"use client";

import { useEffect, useState } from "react";

/** After three seconds of loading, say so (ux.md "Slow"). */
export function StillLoading({ text }: { text: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, []);
  return slow ? <p className="text-sm text-muted-foreground">{text}</p> : null;
}
