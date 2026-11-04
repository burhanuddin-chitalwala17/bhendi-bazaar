"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/forms/FormField";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";
import { useBulkProductActions } from "@/components/product/console/useBulkProductActions";
import {
  BULK_ACTION,
  BULK_PRICE_MODE,
  type BulkAction,
  type BulkActionResultDTO,
  type BulkPriceMode,
} from "@server/catalog/product-bulk.types";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";
import type { BulkProductActionInput } from "@/lib/validation/schemas/product-bulk.schema";
import {
  DIRECTION,
  SKIP_REASON_COPY,
  cellKey,
  priceAction,
  priceChangeFrom,
  seenAt,
  stockRowsFrom,
  type Direction,
  type StockProduct,
} from "./bulk-input";
import { BULK_COPY } from "./bulk-copy";

export interface BulkTarget extends StockProduct {
  name: string;
}

export interface BulkLocation {
  id: string;
  name: string;
}

export interface BulkMarketplace {
  channel: MarketplaceChannel;
  label: string;
}

interface BulkActionDialogProps {
  /** The action being entered; null is closed. */
  action: BulkAction | null;
  onClose: () => void;
  products: readonly BulkTarget[];
  locations: readonly BulkLocation[];
  marketplaces: readonly BulkMarketplace[];
  /** Called once the server answered, so the list can let go of the selection. */
  onDone: () => void;
}

/**
 * Enter one bulk change, send it as one request, then say what happened: what changed, what was
 * left and why, and any stock someone else moved meanwhile (design-system Q29). Never disabled:
 * an incomplete entry says what is missing instead (ADR-0053).
 */
export function BulkActionDialog({ action, onClose, products, locations, marketplaces, onDone }: BulkActionDialogProps) {
  const { run, running, team } = useBulkProductActions();
  const [result, setResult] = useState<BulkActionResultDTO | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<BulkPriceMode>(BULK_PRICE_MODE.SET);
  const [direction, setDirection] = useState<Direction>(DIRECTION.UP);
  const [amount, setAmount] = useState("");
  const [stock, setStock] = useState<Record<string, string>>({});
  const [channel, setChannel] = useState<string>("");

  const close = () => {
    setResult(null);
    setProblem(null);
    setReason("");
    setAmount("");
    setStock({});
    onClose();
  };

  const ids = products.map((p) => p.id);
  const build = (): BulkProductActionInput | string => {
    switch (action) {
      case BULK_ACTION.PRICE: {
        const parsed = priceChangeFrom({ mode, direction, text: amount });
        return parsed.ok ? priceAction(ids, parsed.change) : parsed.message;
      }
      case BULK_ACTION.STOCK: {
        const rows = stockRowsFrom(products, locations.map((l) => l.id), stock);
        if (rows === null) return BULK_COPY.wholeNumbers;
        return rows.length > 0 ? { action: BULK_ACTION.STOCK, rows } : BULK_COPY.nothingChanged;
      }
      case BULK_ACTION.ARCHIVE:
        return { action: BULK_ACTION.ARCHIVE, productIds: ids };
      case BULK_ACTION.SEND: {
        const chosen = marketplaces.find((m) => m.channel === (channel || marketplaces[0]?.channel));
        return chosen ? { action: BULK_ACTION.SEND, productIds: ids, channel: chosen.channel } : BULK_COPY.connectFirst;
      }
      default:
        return BULK_COPY.nothingChanged;
    }
  };

  const submit = async () => {
    const input = build();
    if (typeof input === "string") return setProblem(input);
    if (team && !reason.trim()) return setProblem(BULK_COPY.reasonNeeded);
    setProblem(null);
    const answer = await run({ action: input, reason: team ? reason.trim() : undefined });
    if (!answer) return;
    setResult(answer);
    onDone();
  };

  const title = action ? BULK_COPY.title[action](products.length) : "";
  return (
    <FormDialog open={action !== null} onOpenChange={(open) => !open && close()} title={title}>
      {result ? (
        <BulkResult result={result} products={products} locations={locations} onClose={close} />
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          {action === BULK_ACTION.PRICE && (
            <PriceFields {...{ mode, setMode, direction, setDirection, amount, setAmount }} />
          )}
          {action === BULK_ACTION.STOCK && (
            <StockFields products={products} locations={locations} draft={stock} onChange={setStock} />
          )}
          {action === BULK_ACTION.ARCHIVE && <p className="text-body text-muted-foreground">{BULK_COPY.archiveBody}</p>}
          {action === BULK_ACTION.SEND && (
            <SendFields marketplaces={marketplaces} channel={channel} onChange={setChannel} />
          )}
          {team && (
            <FormField id="bulk-reason" label={BULK_COPY.reasonLabel} hint={BULK_COPY.reasonHint}>
              <Textarea id="bulk-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </FormField>
          )}
          {problem && (
            <p role="alert" className="text-small text-warning">
              {problem}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              {BULK_COPY.cancel}
            </Button>
            <Button type="submit" pending={running} variant={action === BULK_ACTION.ARCHIVE ? "destructive" : "default"}>
              {action ? BULK_COPY.submit[action] : BULK_COPY.cancel}
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  );
}

const MODES: { mode: BulkPriceMode; label: string }[] = [
  { mode: BULK_PRICE_MODE.SET, label: "Set to" },
  { mode: BULK_PRICE_MODE.AMOUNT, label: "Change by ₹" },
  { mode: BULK_PRICE_MODE.PERCENT, label: "Change by %" },
];

function PriceFields({
  mode,
  setMode,
  direction,
  setDirection,
  amount,
  setAmount,
}: {
  mode: BulkPriceMode;
  setMode: (mode: BulkPriceMode) => void;
  direction: Direction;
  setDirection: (direction: Direction) => void;
  amount: string;
  setAmount: (text: string) => void;
}) {
  const relative = mode !== BULK_PRICE_MODE.SET;
  return (
    <div className="space-y-3">
      <div role="group" aria-label={BULK_COPY.howLabel} className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <Button key={m.mode} type="button" size="sm" variant={mode === m.mode ? "default" : "outline"} aria-pressed={mode === m.mode} onClick={() => setMode(m.mode)}>
            {m.label}
          </Button>
        ))}
      </div>
      {relative && (
        <div role="group" aria-label={BULK_COPY.directionLabel} className="grid grid-cols-2 gap-2">
          {[DIRECTION.UP, DIRECTION.DOWN].map((d) => (
            <Button key={d} type="button" size="sm" variant={direction === d ? "secondary" : "ghost"} aria-pressed={direction === d} onClick={() => setDirection(d)}>
              {d === DIRECTION.UP ? BULK_COPY.raise : BULK_COPY.lower}
            </Button>
          ))}
        </div>
      )}
      <FormField id="bulk-amount" label={mode === BULK_PRICE_MODE.PERCENT ? BULK_COPY.percentLabel : BULK_COPY.rupeesLabel}>
        <Input id="bulk-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </FormField>
    </div>
  );
}

function StockFields({
  products,
  locations,
  draft,
  onChange,
}: {
  products: readonly BulkTarget[];
  locations: readonly BulkLocation[];
  draft: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  if (locations.length === 0) return <p className="text-body text-muted-foreground">{BULK_COPY.noLocations}</p>;
  return (
    <ul className="max-h-overlay space-y-3 overflow-y-auto">
      {products.map((product) => (
        <li key={product.id} className="space-y-2">
          <p className="truncate text-small font-semibold">{product.name}</p>
          <div className="grid grid-cols-2 gap-2">
            {locations.map((location) => {
              const key = cellKey(product.id, location.id);
              const seen = seenAt(product, location.id);
              return (
                <FormField key={key} id={`stock-${key}`} label={location.name}>
                  <Input
                    id={`stock-${key}`}
                    inputMode="numeric"
                    value={draft[key] ?? String(seen)}
                    onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
                  />
                </FormField>
              );
            })}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SendFields({ marketplaces, channel, onChange }: { marketplaces: readonly BulkMarketplace[]; channel: string; onChange: (c: string) => void }) {
  if (marketplaces.length === 0) return <p className="text-body text-muted-foreground">{BULK_COPY.connectFirst}</p>;
  return (
    <FormField id="bulk-channel" label={BULK_COPY.channelLabel} hint={BULK_COPY.sendHint}>
      <Select id="bulk-channel" value={channel || marketplaces[0].channel} onChange={(e) => onChange(e.target.value)}>
        {marketplaces.map((m) => (
          <option key={m.channel} value={m.channel}>
            {m.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function BulkResult({
  result,
  products,
  locations,
  onClose,
}: {
  result: BulkActionResultDTO;
  products: readonly BulkTarget[];
  locations: readonly BulkLocation[];
  onClose: () => void;
}) {
  const basePath = useProductsBasePath();
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name ?? BULK_COPY.aProduct;
  const placeOf = (id: string) => locations.find((l) => l.id === id)?.name ?? "";
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="text-body font-semibold">{BULK_COPY.updated[result.action](result.updated)}</p>
      {result.conflicts.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-small font-semibold text-warning">{BULK_COPY.conflictsTitle}</h3>
          <ul className="space-y-2">
            {result.conflicts.map((c) => (
              <li key={cellKey(c.productId, c.orgAddressId)} className="flex items-center gap-3 text-small">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{nameOf(c.productId)}</span>
                  <span className="text-caption text-muted-foreground">{BULK_COPY.conflictLine(placeOf(c.orgAddressId), c.seenQuantity, c.currentQuantity)}</span>
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link prefetch={false} href={`${basePath}/${c.productId}/edit`}>
                    {BULK_COPY.review}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {result.skipped.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-small font-semibold">{BULK_COPY.skippedTitle(result.skipped.length)}</h3>
          <ul className="space-y-1 text-small">
            {result.skipped.map((s) => (
              <li key={s.productId} className="flex gap-2">
                <span className="min-w-0 flex-1 truncate">{nameOf(s.productId)}</span>
                <span className="shrink-0 text-muted-foreground">{SKIP_REASON_COPY[s.reason]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={onClose}>
          {BULK_COPY.done}
        </Button>
      </div>
    </div>
  );
}
