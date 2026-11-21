"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ResponsivePicker } from "@/components/shared/overlays/responsive-picker";
import { AVAILABLE_TOOLS, TOOL_COPY, type AvailableTool } from "@server/content/enhancement.types";
import { STYLED_SHOT_COPY as C } from "./styled-shot-copy";

interface ImproveSplitButtonProps {
  /** The main half: Improve with AI (ai-images Q24). */
  onAi: () => void;
  /** The arrow: one of the six exact tools, which then behaves exactly as today (Q1, R1). */
  onTool: (tool: AvailableTool) => void;
  size?: "default" | "sm" | "lg";
}

/**
 * One button with two halves (improve-with-ai R1, ux.md journeys 1 and 3). On a phone the arrow opens
 * a bottom sheet of the six tools; from `md:` a menu against it (ADR-0040).
 */
export function ImproveSplitButton({ onAi, onTool, size = "lg" }: ImproveSplitButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex">
      <Button type="button" size={size} className="flex-1 rounded-r-none" onClick={onAi}>
        <Icon name="enhance" className="mr-2" />
        {C.improve}
      </Button>
      <ResponsivePicker
        open={open}
        onOpenChange={setOpen}
        title={C.toolsTitle}
        trigger={
          <Button type="button" size={size} aria-label={C.moreWays} className="rounded-l-none border-l border-primary-foreground/30 px-3">
            <Icon name="expand" />
          </Button>
        }
      >
        <ul className="space-y-1">
          {AVAILABLE_TOOLS.map((tool) => (
            <li key={tool}>
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full flex-col items-start justify-start whitespace-normal py-2 text-left"
                onClick={() => {
                  setOpen(false);
                  onTool(tool);
                }}
              >
                <span className="font-semibold">{TOOL_COPY[tool].label}</span>
                <span className="text-caption font-normal text-muted-foreground">{TOOL_COPY[tool].line}</span>
              </Button>
            </li>
          ))}
        </ul>
      </ResponsivePicker>
    </div>
  );
}
