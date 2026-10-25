"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";

import { CHOOSE } from "./facts-copy";

/**
 * "Choose a fact" (ux.md): the marketplace's words, then our answers, one tap each. A sheet on a
 * phone, a popover from `md:` (ADR-0040). Closes on a choice; the card's toast says what happened.
 */
export function FactChoicePicker({
  trigger,
  label,
  fact,
  said,
  options,
  onChoose,
}: {
  trigger: ReactNode;
  label: string;
  fact: string;
  said: string;
  options: Array<{ key: string; label: string }>;
  onChoose: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <ResponsivePicker open={open} onOpenChange={setOpen} trigger={trigger} title={CHOOSE.says(label, fact, said)} description={CHOOSE.which} className="w-80">
      <p className="text-sm font-medium md:hidden">{CHOOSE.which}</p>
      <p className="hidden text-sm md:block">
        {CHOOSE.says(label, fact, said)} {CHOOSE.which}
      </p>
      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {options.map((option) => (
          <li key={option.key}>
            <Button
              variant="ghost"
              className="h-auto min-h-10 w-full justify-start whitespace-normal text-left"
              onClick={() => {
                setOpen(false);
                onChoose(option.key);
              }}
            >
              <span className="line-clamp-2">{option.label}</span>
            </Button>
          </li>
        ))}
      </ul>
    </ResponsivePicker>
  );
}
