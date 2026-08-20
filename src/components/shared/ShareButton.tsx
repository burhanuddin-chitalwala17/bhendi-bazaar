"use client";

import { useState } from "react";
import { Share2, Twitter, Linkedin, MessageCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
}

export function ShareButton({
  url,
  title = "",
  text = "",
  variant = "outline",
  size = "sm",
  className,
  showLabel = true,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`${title} ${text}`);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setOpen(false);
  };

  const socialButtons = [
    {
      name: "WhatsApp",
      icon: MessageCircle,
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
      position: "translate-x-[70px]",
    },
    {
      name: "Twitter",
      icon: Twitter,
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
      position: "translate-x-[47px] -translate-y-[47px]",
    },
    {
      name: "LinkedIn",
      icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      position: "-translate-x-[47px] -translate-y-[47px]",
    },
  ];

  return (
    <div className={cn("relative inline-flex", className)}>
      {/* Social buttons */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 z-0",
          "transition-all duration-300",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
      >
        {socialButtons.map((social, index) => {
          const Icon = social.icon;

          return (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "absolute left-1/2 top-1/2",
                "-translate-x-1/2 -translate-y-1/2",
                "flex h-10 w-10 items-center justify-center",
                "rounded-full border bg-background shadow-md",
                "transition-all duration-300 hover:scale-110",
                open
                  ? social.position
                  : "-translate-x-1/2 -translate-y-1/2 scale-0"
              )}
              style={{
                transitionDelay: `${index * 75}ms`,
              }}
              aria-label={`Share on ${social.name}`}
            >
              <Icon className="h-4 w-4" />
            </a>
          );
        })}

        {/* Copy link */}
        <button
          onClick={handleCopy}
          className={cn(
            "absolute left-1/2 top-1/2",
            "flex h-10 w-10 items-center justify-center",
            "rounded-full border bg-background shadow-md",
            "transition-all duration-300 hover:scale-110",
            open
              ? "-translate-x-[70px]"
              : "-translate-x-1/2 -translate-y-1/2 scale-0"
          )}
          style={{ transitionDelay: "225ms" }}
          aria-label="Copy link"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      {/* Main share button */}
      <Button
        variant={variant}
        size={size}
        className={cn("relative z-10", className)}
        onClick={() => setOpen(!open)}
      >
        <Share2 className="h-4 w-4" />

        {showLabel && <span className="ml-2">Share</span>}
      </Button>
    </div>
  );
}