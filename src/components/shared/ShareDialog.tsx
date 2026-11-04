"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useShare } from "@/hooks/core/useShare";
import { SOCIAL_BRAND } from "@/lib/social-brand";
import { Icon, type IconName } from "@/components/ui/icon";

interface ShareDialogProps {
  url: string;
  title?: string;
  text?: string;
  children?: React.ReactNode;
  triggerClassName?: string;
}

interface ShareOption {
  id: string;
  name: string;
  icon: IconName;
  color: string;
  hoverColor: string;
  action: () => void;
}

export function ShareDialog({
  url,
  title = "",
  text = "",
  children,
  triggerClassName,
}: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const { copyToClipboard, copySuccess } = useShare();

  // A relative path becomes shareable only with an origin on it. Resolved here,
  // at interaction time in the browser — never hardcoded (CLAUDE.md: origins are
  // runtime-known). SSR renders the trigger only, so `window` is safe by the
  // time any share action runs.
  const shareUrl =
    typeof window === "undefined"
      ? url
      : new URL(url, window.location.origin).toString();

  const handleCopyLink = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      // Keep dialog open to show the success message
      setTimeout(() => {
        setOpen(false);
      }, 1000);
    }
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(`${text || title}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
    setOpen(false);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${text}\n\n${shareUrl}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    setOpen(false);
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400",
    );
    setOpen(false);
  };

  const handleTwitter = () => {
    const tweetText = encodeURIComponent(text || title);
    window.open(
      `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400",
    );
    setOpen(false);
  };

  const handleLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400",
    );
    setOpen(false);
  };

  const handleInstagram = () => {
    copyToClipboard(shareUrl);
    toast("Link copied — paste it in your Instagram post or story");
    setOpen(false);
  };

  const shareOptions: ShareOption[] = [
    {
      id: "facebook",
      name: "Facebook",
      icon: "facebook",
      color: SOCIAL_BRAND.facebook.color,
      hoverColor: SOCIAL_BRAND.facebook.hover,
      action: handleFacebook,
    },
    {
      id: "twitter",
      name: "X (Twitter)",
      icon: "x-social",
      color: SOCIAL_BRAND.twitter.color,
      hoverColor: SOCIAL_BRAND.twitter.hover,
      action: handleTwitter,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: "message",
      color: SOCIAL_BRAND.whatsapp.color,
      hoverColor: SOCIAL_BRAND.whatsapp.hover,
      action: handleWhatsApp,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      icon: "linkedin",
      color: SOCIAL_BRAND.linkedin.color,
      hoverColor: SOCIAL_BRAND.linkedin.hover,
      action: handleLinkedIn,
    },
    {
      id: "email",
      name: "Email",
      icon: "email",
      color: SOCIAL_BRAND.email.color,
      hoverColor: SOCIAL_BRAND.email.hover,
      action: handleEmail,
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: "instagram",
      color: SOCIAL_BRAND.instagram.color,
      hoverColor: SOCIAL_BRAND.instagram.hover,
      action: handleInstagram,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className={triggerClassName}>
            <Icon name="share" size="sm" />
            <span>Share</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Share</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Social Media Grid */}
          <div className="grid grid-cols-3 gap-4">
            {shareOptions.map((option) => (
              <Button
                variant="ghost"
                key={option.id}
                onClick={option.action}
                className={`flex flex-col items-center gap-2 rounded-lg border border-border/70 p-4 transition-all ${option.hoverColor} hover:border-border`}
              >
                <div className={`${option.color}`}>
                  <Icon name={option.icon} size="lg" />
                </div>
                <span className="line-clamp-1 text-center text-caption font-medium">
                  {option.name}
                </span>
              </Button>
            ))}
          </div>

          {/* Copy Link Section */}
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={handleCopyLink}
              className="flex h-auto w-full items-center justify-between gap-3 whitespace-normal border-border/70 bg-muted/30 hover:bg-muted/50 hover:border-border"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {copySuccess ? (
                  <Icon name="done" size="md" tone="success" />
                ) : (
                  <Icon name="copy" size="md" tone="muted" />
                )}
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-small font-medium">
                    {copySuccess ? "Copied" : "Copy link"}
                  </span>
                  <span className="w-full truncate text-caption text-muted-foreground">
                    {url}
                  </span>
                </div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
