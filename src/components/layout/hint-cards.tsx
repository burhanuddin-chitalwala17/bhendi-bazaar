"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HINT_COPY } from "./portal-hints";

/**
 * One card at a time, with dots; the last card shows `finish` instead of "Next" (D9). Its state
 * lives only while the sheet is open, so a hint closed mid-way reopens at card 1.
 */
export function HintCards({ cards, finish }: { cards: readonly string[]; finish: ReactNode }) {
  const [index, setIndex] = useState(0);
  const last = index >= cards.length - 1;

  return (
    <div className="space-y-4">
      <p className="text-sm text-foreground">{cards[index]}</p>
      <div className="flex items-center justify-between gap-3">
        {cards.length > 1 ? (
          <div className="flex items-center gap-2">
            <span className="flex gap-1" aria-hidden>
              {cards.map((card, i) => (
                <span key={card} className={cn("size-2 rounded-full", i === index ? "bg-primary" : "bg-muted-foreground/30")} />
              ))}
            </span>
            <span className="text-xs text-muted-foreground">{HINT_COPY.position(index + 1, cards.length)}</span>
          </div>
        ) : (
          <span />
        )}
        {last ? (
          finish
        ) : (
          <Button className="min-h-11" onClick={() => setIndex(index + 1)}>
            {HINT_COPY.next}
          </Button>
        )}
      </div>
    </div>
  );
}
