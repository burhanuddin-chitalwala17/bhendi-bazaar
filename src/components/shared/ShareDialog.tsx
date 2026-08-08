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
import { useShare } from "@/hooks/core/useShare";
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

  const handleCopyLink = async () => {
    const success = await copyToClipboard(url);
    if (success) {
      // Keep dialog open to show the success message
      setTimeout(() => {
        setOpen(false);
      }, 1000);
    }
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent(`${text || title}\n${url}`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
    setOpen(false);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(title);
    const body = encodeURIComponent(`${text}\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    setOpen(false);
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "width=600,height=400"
    );
    setOpen(false);
  };

  const handleTwitter = () => {
    const tweetText = encodeURIComponent(text || title);
    window.open(
      `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(url)}`,
      "_blank",
      "width=600,height=400"
    );
    setOpen(false);
  };

  const handleLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
      "_blank",
      "width=600,height=400"
    );
    setOpen(false);
  };

  const handleInstagram = () => {
    // Instagram doesn't have direct web sharing, so we copy and inform user
    copyToClipboard(url);
    alert(
      "Link copied! Instagram doesn't support direct web sharing. Please paste the link in your Instagram post or story."
    );
    setOpen(false);
  };

  const shareOptions: ShareOption[] = [
    {
      id: "facebook",
      name: "Facebook",
      icon: Facebook,
      color: "text-[#1877F2]",
      hoverColor: "hover:bg-[#1877F2]/10",
      action: handleFacebook,
    },
    {
      id: "twitter",
      name: "X (Twitter)",
      icon: Twitter,
      color: "text-[#000000]",
      hoverColor: "hover:bg-muted",
      action: handleTwitter,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: MessageCircle,
      color: "text-[#25D366]",
      hoverColor: "hover:bg-[#25D366]/10",
      action: handleWhatsApp,
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      icon: Linkedin,
      color: "text-[#0A66C2]",
      hoverColor: "hover:bg-[#0A66C2]/10",
      action: handleLinkedIn,
    },
    {
      id: "email",
      name: "Email",
      icon: Mail,
      color: "text-muted-foreground",
      hoverColor: "hover:bg-muted",
      action: handleEmail,
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: Instagram,
      color: "text-[#E4405F]",
      hoverColor: "hover:bg-[#E4405F]/10",
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
                    {url}
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