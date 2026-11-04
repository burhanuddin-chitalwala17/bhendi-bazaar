"use client";

import { useState, type ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AUTH_COPY } from "./auth-copy";

/** A password input with a show/hide toggle — a 40px target inside the field. */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        className={cn("pr-10", className)}
        {...props}
      />
      <Button
        variant="ghost"
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-0 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? AUTH_COPY.hidePassword : AUTH_COPY.showPassword}
      >
        <Icon name={visible ? "hide" : "show"} />
      </Button>
    </div>
  );
}
