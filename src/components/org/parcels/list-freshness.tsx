"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { SHOP_ORDERS_COPY, updatedAgo } from "./parcel-copy";

const STALE_AFTER_MIN = 5;

/** "Updated 12 min ago" once the list is over five minutes old, with Refresh (ux.md "Stale"). */
export function ListFreshness() {
  const router = useRouter();
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setMinutes(Math.floor((Date.now() - loadedAt) / 60_000)), 30_000);
    return () => clearInterval(timer);
  }, [loadedAt]);

  if (minutes <= STALE_AFTER_MIN) return null;
  return (
    <div className="flex items-center gap-3 text-small text-muted-foreground">
      <span>{updatedAgo(minutes)}</span>
      <Button
        variant="outline"
        size="sm"
        className="min-h-10"
        onClick={() => {
          router.refresh();
          setLoadedAt(Date.now());
          setMinutes(0);
        }}
      >
        {SHOP_ORDERS_COPY.refresh}
      </Button>
    </div>
  );
}
