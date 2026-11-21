"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/shared/overlays/form-dialog";
import { useMutation } from "@/hooks/core/useMutation";
import { formatCurrency, formatDay, rupeesToPaise } from "@/lib/format";
import { REVERSIBLE_KINDS, type AdminCreditAccountDto, type CreditLineDto } from "@server/payouts/credit.types";
import { creditsApiClient, type PaymentProofInput } from "./creditsApiClient";
import { PaymentProofFields, emptyProof } from "./payment-proof-fields";
import { ADMIN_CREDITS_COPY, CREDIT_LINE_LABEL, PAYMENT_METHOD_LABEL } from "./credits-copy";

interface Props {
  orgId: string;
  shop: string;
  initial: AdminCreditAccountDto;
}

/**
 * One shop's credit as the admin keeps it (shop-credits R3, R4, R6, R8): the balance, the shop's
 * margin, offline top-ups recorded with proof, and reversals that leave the original standing.
 */
export function AdminCreditsPanel({ orgId, shop, initial }: Props) {
  const [account, setAccount] = useState(initial);
  const [lines, setLines] = useState<CreditLineDto[]>(initial.lines);
  const [page, setPage] = useState(1);
  const [toppingUp, setToppingUp] = useState(false);
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState<PaymentProofInput>(emptyProof);
  const [reversing, setReversing] = useState<CreditLineDto | null>(null);
  const [reason, setReason] = useState("");
  const [editingMargin, setEditingMargin] = useState(false);
  const [margin, setMargin] = useState("");

  const refreshed = (next: AdminCreditAccountDto) => {
    setAccount(next);
    setLines(next.lines);
    setPage(1);
  };

  const topUp = useMutation(
    async (input: PaymentProofInput & { amountPaise: number }) => ({
      next: await creditsApiClient.recordTopUp(orgId, input),
      amountPaise: input.amountPaise,
    }),
    {
      onSuccess: ({ next, amountPaise: added }) => {
        refreshed(next);
        setToppingUp(false);
        setAmount("");
        setProof(emptyProof());
        toast.success(ADMIN_CREDITS_COPY.recorded(formatCurrency(added), shop));
      },
    },
  );
  const reverse = useMutation(({ lineId, why }: { lineId: string; why: string }) => creditsApiClient.reverse(orgId, lineId, why), {
    successMessage: ADMIN_CREDITS_COPY.reversed,
    onSuccess: (next) => {
      refreshed(next);
      setReversing(null);
      setReason("");
    },
  });
  const saveMargin = useMutation((marginBps: number | null) => creditsApiClient.setOrgMargin(orgId, marginBps), {
    successMessage: ADMIN_CREDITS_COPY.marginSaved,
    onSuccess: (next) => {
      refreshed(next);
      setEditingMargin(false);
    },
  });
  const more = useMutation(async (pageNumber: number) => ({ next: await creditsApiClient.adminAccount(orgId, pageNumber), pageNumber }), {
    showToast: false,
    onSuccess: ({ next, pageNumber }) => {
      setLines((held) => [...held, ...next.lines]);
      setAccount((held) => ({ ...held, hasMore: next.hasMore }));
      setPage(pageNumber);
    },
  });

  const marginBps = account.marginOverrideBps ?? account.platformMarginBps;
  // Rupees typed with up to two decimals become integer paise once, here (Invariant 3).
  const amountPaise = /^\d+(\.\d{1,2})?$/.test(amount.trim()) ? rupeesToPaise(Number(amount.trim())) : 0;

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4 sm:p-5">
        <div>
          <p className="text-caption text-muted-foreground">{ADMIN_CREDITS_COPY.balance}</p>
          <p className="font-heading text-headline font-semibold tabular-nums">{formatCurrency(account.balancePaise)}</p>
          <p className="text-small text-muted-foreground">{ADMIN_CREDITS_COPY.spentThisMonth(formatCurrency(account.spentThisMonthPaise))}</p>
        </div>
        <p className="text-small">
          {ADMIN_CREDITS_COPY.margin(marginBps)}
          {account.marginOverrideBps === null ? ADMIN_CREDITS_COPY.platformDefault : ADMIN_CREDITS_COPY.forThisShop}{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => {
              setMargin(account.marginOverrideBps === null ? "" : String(account.marginOverrideBps / 100));
              setEditingMargin(true);
            }}
          >
            {ADMIN_CREDITS_COPY.change}
          </Button>
        </p>
        <Button type="button" className="w-full sm:w-auto" onClick={() => setToppingUp(true)}>
          {ADMIN_CREDITS_COPY.recordTopUp}
        </Button>
      </Card>

      <ul className="divide-y divide-border rounded-card border border-border bg-card">
        {lines.map((line) => (
          <li key={line.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-medium">
                {CREDIT_LINE_LABEL[line.kind]}
                {line.method ? ` · ${PAYMENT_METHOD_LABEL[line.method]}` : ""}
                {line.reference ? ` · ${line.reference}` : ""}
              </p>
              <p className="text-caption text-muted-foreground">
                {formatDay(line.createdAt)}
                {line.providerCostPaise !== null ? ` · ${ADMIN_CREDITS_COPY.cost(formatCurrency(line.providerCostPaise), line.marginBps ?? 0)}` : ""}
                {line.note && line.kind !== "CHARGE" ? ` · ${line.note}` : ""}
              </p>
              {line.receiptRef && (
                <a href={line.receiptRef} target="_blank" rel="noreferrer" className="text-caption underline">
                  {PAYMENT_METHOD_LABEL[line.method ?? "OTHER"]}
                </a>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-semibold tabular-nums">
                {line.amountPaise > 0 ? "+" : "−"}
                {formatCurrency(Math.abs(line.amountPaise))}
              </span>
              {REVERSIBLE_KINDS.includes(line.kind) &&
                (line.reversed ? (
                  <span className="text-caption text-muted-foreground">{ADMIN_CREDITS_COPY.alreadyReversed}</span>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setReversing(line)}>
                    {ADMIN_CREDITS_COPY.reverse}
                  </Button>
                ))}
            </div>
          </li>
        ))}
      </ul>
      {account.hasMore && (
        <Button type="button" variant="outline" className="w-full" pending={more.isLoading} onClick={() => more.mutate(page + 1).catch(() => {})}>
          {ADMIN_CREDITS_COPY.loadMore}
        </Button>
      )}

      <FormDialog open={toppingUp} onOpenChange={setToppingUp} title={ADMIN_CREDITS_COPY.topUpTitle}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            topUp.mutate({ ...proof, reference: proof.reference.trim(), amountPaise }).catch(() => {});
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="credit-amount">{ADMIN_CREDITS_COPY.amount}</Label>
            <Input id="credit-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <PaymentProofFields value={proof} onChange={setProof} />
          <Button type="submit" className="w-full" pending={topUp.isLoading}>
            {ADMIN_CREDITS_COPY.record}
          </Button>
        </form>
      </FormDialog>

      <FormDialog
        open={reversing !== null}
        onOpenChange={(open) => !open && setReversing(null)}
        title={reversing ? ADMIN_CREDITS_COPY.reverseTitle(CREDIT_LINE_LABEL[reversing.kind], formatDay(reversing.createdAt)) : ""}
        description={ADMIN_CREDITS_COPY.reverseBody}
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (reversing) reverse.mutate({ lineId: reversing.id, why: reason.trim() }).catch(() => {});
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="credit-reason">{ADMIN_CREDITS_COPY.reason}</Label>
            <Input id="credit-reason" value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} />
          </div>
          <Button type="submit" className="w-full" pending={reverse.isLoading}>
            {ADMIN_CREDITS_COPY.reverseAction}
          </Button>
        </form>
      </FormDialog>

      <FormDialog open={editingMargin} onOpenChange={setEditingMargin} title={ADMIN_CREDITS_COPY.marginTitle} description={ADMIN_CREDITS_COPY.marginHint}>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const typed = margin.trim();
            // Percent with up to two decimals, as basis points; empty follows the platform.
            saveMargin.mutate(typed === "" ? null : Math.round(Number(typed) * 100)).catch(() => {});
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="credit-margin">{ADMIN_CREDITS_COPY.marginLabel}</Label>
            <Input id="credit-margin" inputMode="decimal" value={margin} onChange={(event) => setMargin(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" pending={saveMargin.isLoading}>
              {ADMIN_CREDITS_COPY.saveMargin}
            </Button>
            {account.marginOverrideBps !== null && (
              <Button type="button" variant="outline" onClick={() => saveMargin.mutate(null).catch(() => {})}>
                {ADMIN_CREDITS_COPY.useDefault}
              </Button>
            )}
          </div>
        </form>
      </FormDialog>
    </div>
  );
}
