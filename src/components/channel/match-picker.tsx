"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useDebounce } from "@/hooks/core/useDebounce";
import { formatCurrency } from "@/lib/format";
import type { SettlePickerProductDTO } from "@server/channels/channel-connection.types";

import { channelsApiClient } from "./channelsApiClient";
import { ListingImage } from "./listing-image";
import { PICKER, SETTLE_ACTION } from "./settle-copy";
import { ROUTES } from "@server/shared/routes";

interface MatchPickerProps {
  orgId: string;
  listingId: string;
  label: string;
  /** Where "Add it as a new product instead" goes. */
  addNewHref: string;
  trigger: React.ReactNode;
}

/**
 * Choosing the product a listing is (product-merge ux.md "Match picker"): similar names first,
 * then a search over the shop's products. Picking opens the Settle page to compare.
 */
export function MatchPicker({ orgId, listingId, label, addNewHref, trigger }: MatchPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const query = useDebounce(search.trim(), 300);
  const [slow, setSlow] = useState(false);

  const { data, loading, error, refetch } = useAsyncData(
    (signal) => channelsApiClient.settlePickerProducts(orgId, listingId, query, signal),
    { enabled: open, refetchDependencies: [query, open] },
  );

  useEffect(() => {
    if (!loading) return setSlow(false);
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  const pick = (product: SettlePickerProductDTO) => {
    if (product.linkedHere) return toast.info(PICKER.linkedHereWhy(label));
    setOpen(false);
    router.push(`${ROUTES.org.channelSettle(orgId)}?listing=${listingId}&productId=${product.id}`);
  };

  const row = (product: SettlePickerProductDTO) => (
    <li key={product.id}>
      <Button
        variant="ghost"
        className="h-auto w-full justify-start gap-3 whitespace-normal px-2 py-2 text-left"
        onClick={() => pick(product)}
      >
        <ListingImage url={product.imageUrl} title={product.name} ours />
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-sm font-medium">{product.name}</span>
          <span className="text-xs text-muted-foreground">
            {product.linkedHere
              ? PICKER.linkedHere(label)
              : [product.sku ? `SKU ${product.sku}` : null, formatCurrency(product.pricePaise)].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Button>
    </li>
  );

  return (
    <ResponsivePicker open={open} onOpenChange={setOpen} trigger={trigger} title={PICKER.title} className="w-96">
      <Input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={PICKER.search}
        aria-label={PICKER.search}
      />
      {loading && !data && (
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-12 rounded-field" />
          ))}
          {slow && <p className="text-sm text-muted-foreground">{PICKER.stillLoading}</p>}
        </div>
      )}
      {error && (
        <div role="alert" className="flex flex-col gap-2 rounded-card border border-warning bg-warning/10 p-3 text-sm">
          <p>{PICKER.loadFailed}</p>
          <Button variant="outline" className="min-h-10 self-start" onClick={() => void refetch()}>
            {SETTLE_ACTION.tryAgain}
          </Button>
        </div>
      )}
      {data && (
        <div className="flex max-h-overlay flex-col gap-3 overflow-y-auto">
          {data.similar.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{PICKER.similar}</h3>
              <ul>{data.similar.map(row)}</ul>
            </section>
          )}
          {data.all.length > 0 && (
            <section className="flex flex-col gap-1">
              <h3 className="text-xs font-semibold uppercase tracking-eyebrow text-muted-foreground">{PICKER.all}</h3>
              <ul>{data.all.map(row)}</ul>
            </section>
          )}
          {data.similar.length === 0 && data.all.length === 0 && (
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>{PICKER.noMatch(query)}</p>
              <Button asChild variant="outline" className="min-h-10 self-start">
                <Link href={addNewHref}>{SETTLE_ACTION.addNew}</Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </ResponsivePicker>
  );
}
