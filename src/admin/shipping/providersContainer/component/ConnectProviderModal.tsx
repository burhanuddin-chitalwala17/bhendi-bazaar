// src/components/admin/shipping/ConnectProviderModal.tsx

"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConnectionRequestBody, ConnectionResponse } from "../types";

interface ConnectProviderModalProps {
  providerId: string;
  providerName: string;
  open: boolean;
  onClose: () => void;
  onConnect: (
    providerId: string,
    requestBody: ConnectionRequestBody
  ) => Promise<ConnectionResponse>;
  isConnecting?: boolean;
}

export function ConnectProviderModal({
  providerId,
  providerName,
  open,
  onClose,
  onConnect,
  isConnecting = false,
}: ConnectProviderModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Clear on close, during render. Driven by `open` so it fires even if the
  // parent closes without calling onClose.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setEmail("");
      setPassword("");
      setError(null);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const requestBody: ConnectionRequestBody = {
      type: "email_password",
      email,
      password,
    };

    const response = await onConnect(providerId, requestBody);

    if (response.success) {
      onClose();
    }

    if (!response.success) {
      setError(
        response.error ?? "Failed to connect. Please check your credentials."
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {providerName} Account</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="rounded-xl border border-border/60 bg-muted/50 p-3 text-xs text-muted-foreground">
            These are <span className="font-semibold text-foreground">API user</span>{" "}
            credentials, not your {providerName} dashboard login. Create them under{" "}
            <span className="font-semibold text-foreground">
              Settings → API → Configure
            </span>
            , using an email different from your registered one.
          </p>

          <div>
            <Label htmlFor="email">API user email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isConnecting}
            />
          </div>

          <div>
            <Label htmlFor="password">API user password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isConnecting}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isConnecting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isConnecting}>
              {isConnecting ? "Connecting..." : "Connect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}