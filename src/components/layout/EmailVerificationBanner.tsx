"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { authApiClient } from "@/components/auth/authApiClient";
import { useMutation } from "@/hooks/core/useMutation";
import { ApiError } from "@/lib/api-error";
import { EMAIL_VERIFICATION_BANNER_COPY } from "./layout-copy";

export function EmailVerificationBanner() {
  const { data: session, status, update } = useSession();
  // Rides the session token (see auth-config.ts) — the banner no longer forces a
  // per-page /api/profile fetch just to know whether to show.
  const isEmailVerified = session?.user?.isEmailVerified ?? true;

  // The banner reports in place, so the hook's toasts stay off.
  const { mutate: resendVerification, isLoading: isResending } = useMutation(
    authApiClient.resendVerification,
    { showToast: false },
  );

  const [isVisible, setIsVisible] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Syncs with sessionStorage. A lazy useState initialiser would hydrate-mismatch.
  useEffect(() => {
    // Clear dismissal if verification status becomes false
    // (e.g., when user updates their email)
    if (!isEmailVerified) {
      sessionStorage.removeItem("email-verification-banner-dismissed");
    }

    // Show banner if not verified and user hasn't dismissed it
    if (status === "authenticated" && !isEmailVerified) {
      const dismissed = sessionStorage.getItem(
        "email-verification-banner-dismissed",
      );
      if (!dismissed) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects sessionStorage, an external system
        setIsVisible(true);
      }
    } else {
      setIsVisible(false);
    }
  }, [isEmailVerified, status]);

  // Reacts to the URL and rewrites it via replaceState.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verification = params.get("verification");

    if (verification === "success") {
      update(); // Re-read isEmailVerified into the session token (auth-config jwt update)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the URL, which we also rewrite below
      setIsVisible(false);
      sessionStorage.removeItem("email-verification-banner-dismissed");
      setResendMessage(EMAIL_VERIFICATION_BANNER_COPY.verified);
      setTimeout(() => setResendMessage(null), 5000);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (verification === "error") {
      const message = params.get("message");
      setResendMessage(message || EMAIL_VERIFICATION_BANNER_COPY.verifyFailed);
      setTimeout(() => setResendMessage(null), 5000);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [update]);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem("email-verification-banner-dismissed", "true");
  };

  const handleResendEmail = async () => {
    setResendMessage(null);

    try {
      const result = await resendVerification();
      setResendMessage(result?.message || EMAIL_VERIFICATION_BANNER_COPY.sent);
    } catch (error) {
      console.error("Failed to resend verification email:", error);
      setResendMessage(
        error instanceof ApiError
          ? error.message
          : EMAIL_VERIFICATION_BANNER_COPY.sendFailed,
      );
    }

    setTimeout(() => setResendMessage(null), 5000);
  };

  if (!isVisible || status !== "authenticated") {
    return null;
  }

  return (
    <div className="bg-warning/10 border-b border-warning/30">
      <div className="mx-auto max-w-page px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            <Icon name="email" size="md" tone="warning" />
            <div className="flex-1">
              <p className="text-small font-medium text-warning">
                {EMAIL_VERIFICATION_BANNER_COPY.pleaseVerifyYourEmailAddress}
              </p>
              <p className="mt-0.5 text-caption text-warning">
                Check your inbox for a verification link or{" "}
                <Button
                  variant="link"
                  onClick={handleResendEmail}
                  pending={isResending}
                  className="h-auto p-0 font-semibold underline hover:no-underline"
                >
                  {EMAIL_VERIFICATION_BANNER_COPY.resendEmail}
                </Button>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            shape="icon"
            onClick={handleClose}
            className="-m-2 flex h-10 w-10 items-center justify-center text-warning hover:text-warning/80"
            aria-label={EMAIL_VERIFICATION_BANNER_COPY.dismiss}
          >
            <Icon name="close" size="md" />
          </Button>
        </div>

        {resendMessage && (
          <div className="mt-2 flex items-center gap-2 text-small">
            {resendMessage.includes("success") ||
            resendMessage.includes("sent") ? (
              <>
                <Icon name="success" size="sm" tone="success" />
                <span className="text-success">{resendMessage}</span>
              </>
            ) : (
              <>
                <Icon name="error" size="sm" tone="destructive" />
                <span className="text-destructive">{resendMessage}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
