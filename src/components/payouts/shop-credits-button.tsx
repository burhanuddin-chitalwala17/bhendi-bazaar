"use client";

import { useState } from "react";
import NextImage from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { TaskDialog } from "@/components/shared/overlays/task-dialog";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { formatCurrency, formatDay } from "@/lib/format";
import type { CreditAccountDto, CreditLineDto, PaymentDetailsDto } from "@server/payouts/credit.types";
import { creditsApiClient } from "./creditsApiClient";
import { CREDIT_LINE_LABEL, PAYMENT_METHOD_LABEL, SHOP_CREDITS_COPY } from "./credits-copy";

/** Below this the sheet warns that AI pictures are about to stop (ux.md copy). */
const LOW_PAISE = 5_000;

function CopyRow({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(SHOP_CREDITS_COPY.copied);
    } catch {
      // Some app views refuse the clipboard; the value is selectable text all the same.
    }
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className="select-all break-all font-medium">{value}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {SHOP_CREDITS_COPY.copy}
      </Button>
    </div>
  );
}

function HowToPay({ details }: { details: PaymentDetailsDto }) {
  const rows = [
    [SHOP_CREDITS_COPY.upiId, details.upiId],
    [SHOP_CREDITS_COPY.accountName, details.accountName],
    [SHOP_CREDITS_COPY.accountNumber, details.accountNumber],
    [SHOP_CREDITS_COPY.ifsc, details.ifsc],
    [SHOP_CREDITS_COPY.bank, details.bankName],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  if (rows.length === 0 && !details.qrRef) {
    return <p className="text-small text-muted-foreground">{SHOP_CREDITS_COPY.noDetails}</p>;
  }
  return (
    <div className="space-y-3">
      {details.qrRef && (
        <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-card bg-card">
          <NextImage src={details.qrRef} alt={SHOP_CREDITS_COPY.qrAlt} fill sizes="192px" className="object-contain" />
        </div>
      )}
      {rows.map(([label, value]) => (
        <CopyRow key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function LineRow({ line }: { line: CreditLineDto }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-medium">
          {CREDIT_LINE_LABEL[line.kind]}
          {line.method ? ` · ${PAYMENT_METHOD_LABEL[line.method]}` : ""}
        </p>
        <p className="text-caption text-muted-foreground">
          {formatDay(line.createdAt)}
          {line.reference ? ` · ${line.reference}` : ""}
        </p>
      </div>
      <span className={`shrink-0 font-semibold tabular-nums ${line.amountPaise > 0 ? "text-success" : ""}`}>
        {line.amountPaise > 0 ? "+" : "−"}
        {formatCurrency(Math.abs(line.amountPaise))}
      </span>
    </li>
  );
}

/**
 * The shop's credit for AI pictures, from the Photos page (ai-images/shop-credits R8, Q34, Q35): the
 * balance on the button, and a sheet with why credit exists, how to top up, and every line.
 */
export function ShopCreditsButton({ orgId, shop, balancePaise }: { orgId: string; shop: string; balancePaise: number }) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState<{ lines: CreditLineDto[]; page: number; hasMore: boolean } | null>(null);
  const account = useAsyncData<CreditAccountDto>((signal) => creditsApiClient.account(orgId, 1, signal), {
    enabled: open,
    refetchDependencies: [open],
    onSuccess: () => setExtra(null),
  });
  const more = useMutation(
    async (page: number) => ({ page, next: await creditsApiClient.account(orgId, page) }),
    {
      showToast: false,
      onSuccess: ({ page, next }) =>
        setExtra((held) => ({ lines: [...(held?.lines ?? []), ...next.lines], page, hasMore: next.hasMore })),
    },
  );

  const data = account.data;
  const balance = data?.balancePaise ?? balancePaise;
  const lines = [...(data?.lines ?? []), ...(extra?.lines ?? [])];
  const hasMore = extra ? extra.hasMore : (data?.hasMore ?? false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Icon name="payout" className="mr-2" />
        {SHOP_CREDITS_COPY.button(formatCurrency(balance))}
      </Button>
      <TaskDialog open={open} onOpenChange={setOpen} title={SHOP_CREDITS_COPY.title} description={SHOP_CREDITS_COPY.description}>
        <div className="space-y-5">
          <div>
            <p className="font-heading text-display font-semibold tabular-nums">{formatCurrency(balance)}</p>
            <p className="text-small text-muted-foreground">{SHOP_CREDITS_COPY.left}</p>
            {balance < LOW_PAISE && <p className="mt-1 text-small text-warning">{SHOP_CREDITS_COPY.low}</p>}
          </div>
          <p className="text-small">{SHOP_CREDITS_COPY.note}</p>

          {account.error ? (
            <div className="space-y-2">
              <p className="text-small text-destructive">{SHOP_CREDITS_COPY.loadFailed}</p>
              <Button type="button" variant="outline" onClick={() => account.refetch()}>
                {SHOP_CREDITS_COPY.retry}
              </Button>
            </div>
          ) : !data ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <section className="space-y-3">
                <h3 className="text-small font-semibold">{SHOP_CREDITS_COPY.howToPay}</h3>
                <HowToPay details={data.paymentDetails} />
                <ContactLauncher
                  variant="default"
                  className="w-full"
                  prefill={{ subject: SHOP_CREDITS_COPY.topUpSubject, message: SHOP_CREDITS_COPY.topUpMessage(shop) }}
                >
                  {SHOP_CREDITS_COPY.talkToUs}
                </ContactLauncher>
              </section>
              <section className="space-y-1">
                <h3 className="text-small font-semibold">{SHOP_CREDITS_COPY.history}</h3>
                <ul className="divide-y divide-border">
                  {lines.map((line) => (
                    <LineRow key={line.id} line={line} />
                  ))}
                </ul>
                {hasMore && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    pending={more.isLoading}
                    onClick={() => more.mutate((extra?.page ?? 1) + 1).catch(() => {})}
                  >
                    {SHOP_CREDITS_COPY.loadMore}
                  </Button>
                )}
              </section>
            </>
          )}
        </div>
      </TaskDialog>
    </>
  );
}
