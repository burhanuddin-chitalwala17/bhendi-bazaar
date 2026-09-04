"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useShare } from "@/hooks/core/useShare";
import { SOCIAL_BRAND } from "@/lib/social-brand";
import {
  Share2,
  Copy,
  Check,
  Mail,
  MessageCircle,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
} from "lucide-react";

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
  icon: React.ComponentType<{ className?: string }>;
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
    typeof window === "undefined" ? url : new URL(url, window.location.origin).toString();

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
    const subject = encodeURIComponent(title || "Bhendi Bazaar");
    const body = encodeURIComponent(text ? `${text}\n\n${shareUrl}` : shareUrl);
    // A mail client is a navigation, not a document: `window.open` is what a popup
    // blocker stops first, and where it survives it leaves a blank tab behind.
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
    setOpen(false);
  };

  const handleTwitter = () => {
    const tweetText = encodeURIComponent(text || title);
    window.open(
      `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
    setOpen(false);
  };

  const handleLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "width=600,height=400"
    );
    setOpen(false);
  };

  const handleInstagram = async () => {
    // Instagram has no web share endpoint, so the link goes to the clipboard. The
    // write is awaited before the dialog closes: the alert that used to stand here
    // blocked the gesture the clipboard needs, and it copied the bare relative path.
    const success = await copyToClipboard(shareUrl);
    if (success) {
      toast.success("Link copied — paste it into your Instagram post or story");
    } else {
      toast.error("Could not copy the link");
    }
    setOpen(false);
  };

  const shareOptions: ShareOption[] = [
    {
      id: "facebook",
      name: "Facebook",
      icon: Facebook,
      color: SOCIAL_BRAND.facebook.color,
      hoverColor: SOCIAL_BRAND.facebook.hover,
      action: handleFacebook,
    },
    {
      id: "twitter",
      name: "X (Twitter)",
      icon: Twitter,
      color: SOCIAL_BRAND.twitter.color,
      hoverColor: SOCIAL_BRAND.twitter.hover,
      action: handleTwitter,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: MessageCircle,
      color: SOCIAL_BRAND.whatsapp.color,
      hoverColor: SOCIAL_BRAND.whatsapp.hover,
      action: handleWhatsApp,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      icon: Linkedin,
      color: SOCIAL_BRAND.linkedin.color,
      hoverColor: SOCIAL_BRAND.linkedin.hover,
      action: handleLinkedIn,
    },
    {
      id: "email",
      name: "Email",
      icon: Mail,
      color: SOCIAL_BRAND.email.color,
      hoverColor: SOCIAL_BRAND.email.hover,
      action: handleEmail,
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: Instagram,
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
            <Share2 className="h-4 w-4" />
            <span className="ml-2">Share</span>
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
              <button
                key={option.id}
                onClick={option.action}
                className={`flex flex-col items-center gap-2 rounded-lg border border-border/70 p-4 transition-all ${option.hoverColor} hover:border-border`}
              >
                <div className={`${option.color}`}>
                  <option.icon className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium text-center line-clamp-1">
                  {option.name}
                </span>
              </button>
            ))}
          </div>

          {/* Copy Link Section */}
          <div className="pt-2">
            <button
              onClick={handleCopyLink}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3 transition-all hover:bg-muted/50 hover:border-border"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {copySuccess ? (
                  <Check className="h-5 w-5 shrink-0 text-success" />
                ) : (
                  <Copy className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="text-sm font-medium">
                    {copySuccess ? "Copied!" : "Copy Link"}
                  </span>
                  <span className="text-xs text-muted-foreground truncate w-full">
                    {shareUrl}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}