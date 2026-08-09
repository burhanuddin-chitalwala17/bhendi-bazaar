"use client";

import { useState, useEffect } from "react";
import { X, Mail, AlertCircle, CheckCircle } from "lucide-react";
import { useProfileContext } from "@/context/ProfileContext";
import { useAuth } from "@/lib/auth";

export function EmailVerificationBanner() {
  const { status } = useAuth();
  const { 
    isEmailVerified, 
    resendVerificationEmail,
    refetch 
  } = useProfileContext();
  
  const [isVisible, setIsVisible] = useState(false);
  const [isResending, setIsResending] = useState(false);
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
      const dismissed = sessionStorage.getItem("email-verification-banner-dismissed");
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
      refetch(); // Refresh profile to get updated verification status
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the URL, which we also rewrite below
      setIsVisible(false);
      sessionStorage.removeItem("email-verification-banner-dismissed");
      setResendMessage("Email verified successfully!");
      setTimeout(() => setResendMessage(null), 5000);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (verification === "error") {
      const message = params.get("message");
      setResendMessage(message || "Verification failed");
      setTimeout(() => setResendMessage(null), 5000);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [refetch]);

  const handleClose = () => {
    setIsVisible(false);
    sessionStorage.setItem("email-verification-banner-dismissed", "true");
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    setResendMessage(null);

    const result = await resendVerificationEmail();
    setResendMessage(result.message);
    setIsResending(false);
    
    setTimeout(() => setResendMessage(null), 5000);
  };

  if (!isVisible || status !== "authenticated") {
    return null;
  }

  return (
    <div className="bg-warning/10 border-b border-warning/30">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-1">
            <Mail className="h-5 w-5 text-warning dark:text-warning shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-warning">
                Please verify your email address
              </p>
              <p className="text-xs text-warning/80 mt-0.5">
                Check your inbox for a verification link or{" "}
                <button
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="underline hover:no-underline font-semibold disabled:opacity-50"
                >
                  {isResending ? "Sending..." : "resend email"}
                </button>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="-m-2 flex h-10 w-10 items-center justify-center text-warning hover:text-warning/80"
            aria-label="Dismiss"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        {resendMessage && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            {resendMessage.includes("success") || resendMessage.includes("sent") ? (
              <>
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-success">{resendMessage}</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-destructive">{resendMessage}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}