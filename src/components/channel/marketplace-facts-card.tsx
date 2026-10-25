"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FACTS_STATE, type FillNowOutcome, type MarketplaceFactRowDTO, type ProductMarketplaceFactsDTO } from "@server/channels/channel-facts.types";

import { AskAdminPicker } from "./ask-admin-picker";
import { FactChoicePicker } from "./fact-choice-picker";
import { ASK_ADMIN, FACTS, FACTS_TOAST } from "./facts-copy";
import { ago } from "./listing-copy";
import { StillLoading } from "./still-loading";
import { useMarketplaceFacts } from "./useMarketplaceFacts";

/** Groups longer than this collapse behind "Show all" (ux.md "Many items"). */
const SHOWN = 5;

/**
 * "Facts from {marketplace}" (marketplace-facts ux.md): what one linked listing filled, what it
 * asks, and the one action that moves it on. The same for every marketplace; nothing is disabled.
 */
export function MarketplaceFactsCard({
  orgId,
  productId,
  shopName,
  card,
}: {
  orgId: string;
  productId: string;
  shopName: string;
  card: ProductMarketplaceFactsDTO;
}) {
  const l = card.label;
  const { run, busy } = useMarketplaceFacts(orgId, card.channel, card.listingId);
  const [filling, setFilling] = useState(false);
  const [failure, setFailure] = useState<FillNowOutcome | null>(null);
  const [all, setAll] = useState({ questions: false, filled: false });

  const fill = async () => {
    setFilling(true);
    setFailure(null);
    const outcome = await run({ action: "fill" });
    setFilling(false);
    if (outcome === "busy" || outcome === "reconnect") setFailure(outcome);
  };
  const fillButton = (text = FACTS.fill(l)) => (
    <Button variant="outline" size="sm" className="min-h-10 self-start" onClick={() => void fill()}>
      {text}
    </Button>
  );
  const message = ASK_ADMIN.message(shopName, l, card.title ?? card.sku, card.sku, card.marketplaceType ?? "");

  const body = () => {
    if (filling) {
      return (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <StillLoading text={FACTS.stillReading(l)} />
        </div>
      );
    }
    if (failure === "busy") return <Line text={FACTS.busy(l)} tone="warning" action={fillButton(FACTS.tryAgain)} />;
    if (failure === "reconnect" || card.state === FACTS_STATE.RECONNECT) {
      return <Line text={FACTS.reconnect(l)} tone="error" action={<LinkButton href={`/org/${orgId}/channels`} text={FACTS.goToChannels} />} />;
    }
    switch (card.state) {
      case FACTS_STATE.NOT_READ:
        return <Line text={FACTS.notRead(l)} action={fillButton()} />;
      case FACTS_STATE.NO_ANSWERS:
        return <Line text={FACTS.noAnswers(l)} action={fillButton()} />;
      case FACTS_STATE.NO_MAPPING:
        return <Line text={FACTS.noMapping(l)} />;
      case FACTS_STATE.NO_TYPE:
        return <Line text={FACTS.noType(l)} action={<LinkButton href={`/org/${orgId}/products/${productId}/edit`} text={FACTS.editProduct} />} />;
      case FACTS_STATE.TYPE_TO_CONFIRM:
      case FACTS_STATE.CATEGORY_TO_CONFIRM:
      case FACTS_STATE.NO_MATCHING_TYPE:
        return <TypeQuestion card={card} onCategory={(id, name) => void run({ action: "category", categoryId: id }, FACTS_TOAST.category(name))} message={message} />;
    }
    const toConfirm = card.questions.length;
    const questions = all.questions ? card.questions : card.questions.slice(0, SHOWN);
    const filled = all.filled ? card.filled : card.filled.slice(0, SHOWN);
    return (
      <div className="flex flex-col gap-4">
        {card.staleCheckedOn && <p className="text-sm font-medium text-warning">{FACTS.stale(l, card.staleCheckedOn)}</p>}
        {toConfirm > 0 ? (
          <p className="text-sm">{FACTS.partial(card.filled.length, toConfirm, l)}</p>
        ) : card.filled.length === 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{FACTS.nothingNew(l)}</p>
            {fillButton()}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm">{FACTS.success(l, card.readAt ? ago(card.readAt, Date.now()) : "")}</p>
            {fillButton()}
          </div>
        )}
        {questions.length > 0 && (
          <ul className="flex flex-col gap-3">
            {questions.map((q) => (
              <li key={q.fact} className="flex flex-col gap-2 rounded-card border p-3">
                <p className="text-sm">{FACTS.toConfirm(l, q.label, q.said)}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.slice(0, 4).map((o) => (
                    <Button key={o.key} variant="outline" size="sm" className="h-auto min-h-10 max-w-full whitespace-normal" onClick={() => void run({ action: "answer", fact: q.fact, value: o.key }, FACTS_TOAST.filled(q.label, l))}>
                      <span className="line-clamp-2">{o.label}</span>
                    </Button>
                  ))}
                  {q.options.length > 4 && (
                    <FactChoicePicker
                      label={l}
                      fact={q.label}
                      said={q.said}
                      options={q.options}
                      onChoose={(key) => void run({ action: "answer", fact: q.fact, value: key }, FACTS_TOAST.filled(q.label, l))}
                      trigger={<Button variant="outline" size="sm" className="min-h-10">{FACTS.chooseOne}</Button>}
                    />
                  )}
                  <Button variant="ghost" size="sm" className="min-h-10" onClick={() => void run({ action: "skip", fact: q.fact, skipped: true })}>
                    {FACTS.skip}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {card.questions.length > SHOWN && !all.questions && <ShowAll onClick={() => setAll((a) => ({ ...a, questions: true }))} />}
        {card.skipped.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{FACTS.skipped}</span>
            {card.skipped.map((s) => (
              <Button key={s.fact} variant="ghost" size="sm" className="min-h-10" onClick={() => void run({ action: "skip", fact: s.fact, skipped: false })}>
                {FACTS.askAgain(s.label)}
              </Button>
            ))}
          </div>
        )}
        {filled.length > 0 && (
          <dl className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filled.map((row) => (
              <FilledRow key={`${row.column}:${row.fact}`} row={row} label={l} editHref={`/org/${orgId}/products/${productId}/edit`} run={run} />
            ))}
          </dl>
        )}
        {card.filled.length > SHOWN && !all.filled && <ShowAll onClick={() => setAll((a) => ({ ...a, filled: true }))} />}
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border bg-card p-4 text-card-foreground" aria-busy={busy}>
      <h2 className="text-base font-semibold">{FACTS.title(l)}</h2>
      {body()}
    </section>
  );
}

function FilledRow({
  row,
  label,
  editHref,
  run,
}: {
  row: MarketplaceFactRowDTO;
  label: string;
  editHref: string;
  run: ReturnType<typeof useMarketplaceFacts>["run"];
}) {
  const edit = row.options.length > 0 ? (
    <FactChoicePicker
      label={label}
      fact={row.label}
      said={row.said}
      options={row.options}
      onChoose={(key) => void run({ action: "change", fact: row.fact, value: key }, FACTS_TOAST.changed(row.label, label))}
      trigger={<Button variant="ghost" size="sm" className="min-h-10">{FACTS.edit}</Button>}
    />
  ) : (
    <LinkButton href={editHref} text={FACTS.edit} variant="ghost" />
  );
  return (
    <div className="flex flex-col gap-1 rounded-card border p-3 text-sm">
      <dt className="text-muted-foreground">{row.label}</dt>
      <dd className="break-words font-medium">{row.value}</dd>
      <dd className="text-xs text-muted-foreground">
        {row.changed ? `${FACTS.changedByYou} (${FACTS.was(row.said, label)})` : row.chosen ? FACTS.youChose(label) : FACTS.from(label)}
      </dd>
      <dd className="flex flex-wrap gap-1">
        {edit}
        {row.changed && (
          <Button variant="ghost" size="sm" className="min-h-10" onClick={() => void run({ action: "reset", fact: row.fact }, FACTS_TOAST.reset(label))}>
            {FACTS.reset(label)}
          </Button>
        )}
      </dd>
    </div>
  );
}

/** Type to confirm, Category to confirm, No matching type (ux.md; Q11, Q25, Q6). */
function TypeQuestion({
  card,
  onCategory,
  message,
}: {
  card: ProductMarketplaceFactsDTO;
  onCategory: (id: string, name: string) => void;
  message: string;
}) {
  const l = card.label;
  const theirs = card.marketplaceType ?? "";
  const [typeKey, setTypeKey] = useState<string | null>(card.types.length === 1 ? card.types[0].key : null);
  const type = card.types.find((t) => t.key === typeKey) ?? null;
  const intro =
    card.state === FACTS_STATE.NO_MATCHING_TYPE
      ? FACTS.noMatchingType(l, theirs)
      : type
        ? FACTS.categoryToConfirm(l, theirs, type.label)
        : FACTS.typeToConfirm(l, theirs);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">{intro}</p>
      {card.state === FACTS_STATE.NO_MATCHING_TYPE && !type && <p className="text-sm text-muted-foreground">{FACTS.pickOrAsk}</p>}
      <div className="flex flex-wrap gap-2">
        {type
          ? type.categories.map((c) => (
              <Button key={c.id} variant="outline" size="sm" className="h-auto min-h-10 whitespace-normal" onClick={() => onCategory(c.id, c.name)}>
                {c.name}
              </Button>
            ))
          : card.types.map((t) => (
              <Button key={t.key} variant="outline" size="sm" className="min-h-10" onClick={() => setTypeKey(t.key)}>
                {t.label}
              </Button>
            ))}
        {card.state === FACTS_STATE.NO_MATCHING_TYPE && !type && <AskAdminPicker message={message} />}
      </div>
    </div>
  );
}

function Line({ text, tone, action }: { text: string; tone?: "warning" | "error"; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={tone === "error" ? "text-sm font-medium text-destructive" : tone === "warning" ? "text-sm font-medium text-warning" : "text-sm"}>{text}</p>
      {action}
    </div>
  );
}

function LinkButton({ href, text, variant = "outline" }: { href: string; text: string; variant?: "outline" | "ghost" }) {
  return (
    <Button asChild variant={variant} size="sm" className="min-h-10 self-start">
      <Link href={href}>{text}</Link>
    </Button>
  );
}

function ShowAll({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="min-h-10 self-start" onClick={onClick}>
      {FACTS.showAll}
    </Button>
  );
}
