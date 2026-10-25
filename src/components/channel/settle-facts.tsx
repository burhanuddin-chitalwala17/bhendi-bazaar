"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { SettleFactsDTO } from "@server/channels/channel-facts.types";

import { FACTS } from "./facts-copy";

/**
 * "Facts from {marketplace}" on the Settle page (marketplace-facts Q35, ux.md): the chosen category's
 * type decides the facts; clear ones show filled, unclear ones are a tap or a skip. Nothing is saved
 * until "Add product"; the server re-plans from the listing and checks every answer.
 */
export function SettleFacts({
  label,
  facts,
  categoryId,
  answers,
  onAnswer,
}: {
  label: string;
  facts: SettleFactsDTO;
  categoryId: string | undefined;
  answers: Record<string, string>;
  onAnswer: (fact: string, key: string | null) => void;
}) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const typeKey = facts.fixedType ?? (categoryId ? facts.typeOfCategory[categoryId] : undefined);
  const view = typeKey ? facts.byType[typeKey] : undefined;

  const body = () => {
    if (facts.saysNothing) return <p className="text-sm text-muted-foreground">{FACTS.noAnswers(label)}</p>;
    // A matched product with no type, or a category with none: nothing applies until the category has a type.
    if (facts.matching ? !typeKey : categoryId && !typeKey) return <p className="text-sm text-muted-foreground">{FACTS.noType(label)}</p>;
    if (!typeKey || !view) return <p className="text-sm text-muted-foreground">{FACTS.pickCategory(label)}</p>;
    if (view.noMapping) return <p className="text-sm text-muted-foreground">{FACTS.noMapping(label)}</p>;
    if (view.fills.length === 0 && view.questions.length === 0) return <p className="text-sm text-muted-foreground">{FACTS.nothingNew(label)}</p>;
    return (
      <>
        <p className="text-sm text-muted-foreground">{FACTS.settleIntro}</p>
        {view.fills.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {view.fills.map((f) => (
              <li key={f.fact} className="flex flex-wrap gap-x-2">
                <span>{f.label}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium break-words">{f.value}</span>
                <span className="text-muted-foreground">· {FACTS.from(label)}</span>
              </li>
            ))}
          </ul>
        )}
        {view.questions.map((q) =>
          skipped.includes(q.fact) ? (
            <div key={q.fact} className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{FACTS.settleSkipped(q.label)}</span>
              <Button type="button" variant="ghost" size="sm" className="min-h-10" onClick={() => setSkipped((s) => s.filter((f) => f !== q.fact))}>
                {FACTS.askAgainShort}
              </Button>
            </div>
          ) : (
            <div key={q.fact} className="flex flex-col gap-2 rounded-card border p-3">
              <p className="text-sm">{FACTS.toConfirm(label, q.label, q.said)}</p>
              <div className="flex flex-wrap gap-2">
                {q.options.map((o) => {
                  const on = answers[q.fact] === o.key;
                  return (
                    <Button
                      key={o.key}
                      type="button"
                      variant={on ? "default" : "outline"}
                      size="sm"
                      aria-pressed={on}
                      className="h-auto min-h-10 max-w-full whitespace-normal"
                      onClick={() => onAnswer(q.fact, on ? null : o.key)}
                    >
                      <span className="line-clamp-2">{o.label}</span>
                    </Button>
                  );
                })}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-10"
                  onClick={() => {
                    onAnswer(q.fact, null);
                    setSkipped((s) => [...s, q.fact]);
                  }}
                >
                  {FACTS.skip}
                </Button>
              </div>
            </div>
          ),
        )}
      </>
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-card border p-3">
      <h2 className="text-sm font-semibold">{FACTS.title(label)}</h2>
      {body()}
    </section>
  );
}
