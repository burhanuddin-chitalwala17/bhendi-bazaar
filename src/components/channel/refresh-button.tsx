"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/** Read the page again (product-merge ux.md "Couldn't read the listing"). */
export function RefreshButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button variant="outline" className="min-h-10 self-start" onClick={() => router.refresh()}>
      {label}
    </Button>
  );
}
