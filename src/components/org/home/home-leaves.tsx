"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HOME_COPY } from "./home-copy";

/** Said once after a task opened from Home is saved (R7), then dropped from the URL so a refresh is quiet. */
export function DoneToast({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    toast.success(message, actionLabel && onAction ? { action: { label: actionLabel, onClick: onAction } } : undefined);
    router.replace(pathname, { scroll: false });
  }, [message, actionLabel, onAction, pathname, router]);
  return null;
}

const STALE_MINUTES = 15;

/** ux Stale: a Home left open says how old its figures are once they pass 15 minutes. */
export function UpdatedLine({ readAt }: { readAt: string }) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(0);
  useEffect(() => {
    const tick = () => setMinutes(Math.floor((Date.now() - new Date(readAt).getTime()) / 60_000));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [readAt]);
  if (minutes < STALE_MINUTES) return null;
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      {HOME_COPY.updated(minutes)}
      <Button variant="link" size="sm" className="min-h-11" onClick={() => router.refresh()}>
        {HOME_COPY.refresh}
      </Button>
    </p>
  );
}
