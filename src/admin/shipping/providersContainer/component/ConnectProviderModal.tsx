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

  // Clear the form when the modal closes. Detected during render rather than in
  // an effect, and driven by the `open` prop rather than by onClose, so it still
  // happens if the parent closes the modal without calling the handler.
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
          <div>
            <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="password">Password</Label>
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
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