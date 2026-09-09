"use client";

/**
 * Choosing what to auction.
 *
 * One product per event, so this is a pick-one list rather than the multi-select the
 * offer picker uses — the dialog closes on the choice and the form opens on the next
 * page, which keeps the long form off a modal a phone can barely fit.
 *
 * Products already under a live event are absent from the results (the endpoint leaves
 * them out), because the picker is where an org learns what is available and a
 * choice that cannot be taken is worse than a shorter list.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface PickerProduct {
  id: string;
  name: string;
}

export function CreateBiddingDialog({
  /** Where the create flow continues — `/org/<id>/bidding`. */
  basePath,
  /** Where to search. Scoped by the route that renders this, never by the body. */
  searchPath,
}: {
  basePath: string;
  searchPath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PickerProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Searched at the server rather than filtered in the browser, for the reason the
  // offer picker gives: a capped fetch stops finding things with nothing on screen to
  // say so. Debounced, so typing a word is one query.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const query = term ? `?q=${encodeURIComponent(term)}` : "";
        const response = await fetch(`${searchPath}${query}`);
        if (response.ok) {
          const data = (await response.json()) as { products: PickerProduct[]; total: number };
          setResults(data.products);
          setTotal(data.total);
        }
      } finally {
        setIsLoading(false);
      }
    }, term ? 250 : 0);
    return () => clearTimeout(timer);
  }, [term, open, searchPath]);

  const choose = (productId: string) => {
    setOpen(false);
    router.push(`${basePath}/new?productId=${encodeURIComponent(productId)}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Gavel className="size-4" aria-hidden />
          Create bidding
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Which item?</DialogTitle>
          <DialogDescription>
            One item per bidding event. While it runs, that item cannot be bought
            directly.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Find a product"
            className="pl-9"
            aria-label="Find a product"
          />
        </div>

        <div className="max-h-64 space-y-1 overflow-y-auto rounded-field border border-border p-1">
          {results.map((product) => (
            <Button
              key={product.id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start px-3 py-2.5 text-left text-sm font-normal"
              onClick={() => choose(product.id)}
            >
              {product.name}
            </Button>
          ))}
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {isLoading
                ? "Searching…"
                : term
                  ? "Nothing matches that."
                  : "Nothing here can go up for bidding right now."}
            </p>
          )}
        </div>

        {/* Say what is not on screen — a silent cap reads as "no such product". */}
        <p className="text-2xs text-muted-foreground">
          {total > results.length
            ? `Showing ${results.length} of ${total} — search to narrow`
            : `${total} product${total === 1 ? "" : "s"} available`}
        </p>
      </DialogContent>
    </Dialog>
  );
}
