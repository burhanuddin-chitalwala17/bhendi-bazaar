// src/components/admin/shipping/ProviderCard.tsx

"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { ShippingProvider } from "../types";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ProviderCardProps {
  provider: ShippingProvider;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
}

export function ProviderCard({
  provider,
  onConnect,
  onDisconnect,
  isConnecting = false,
  isDisconnecting = false,
}: ProviderCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Provider Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {provider.logoUrl && (
                <Image
                  src={provider.logoUrl}
                  alt={provider.name}
                  width={32}
                  height={32}
                />
              )}
              <h3 className="text-lg font-semibold">{provider.name}</h3>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  provider.isConnected ? "bg-success" : "bg-destructive"
                )}
              />
              <span className="text-sm text-muted-foreground">
                {provider.isConnected ? "Connected" : "Not Connected"}
              </span>
            </div>
          </div>

          {/* Description */}
          {provider.description && (
            <p className="text-sm text-muted-foreground mt-2">{provider.description}</p>
          )}

          {/* Connection Status */}
          <div className="mt-3">
            {provider.isConnected ? (
              <div className="space-y-2">
                {provider.accountInfo && "email" in provider.accountInfo ? (
                  <p className="text-xs text-muted-foreground">
                    {provider.accountInfo.email as string}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDisconnect}
                  disabled={isDisconnecting}
                >
                  {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={onConnect} disabled={isConnecting}>
                {isConnecting ? "Connecting..." : "Connect Account"}
              </Button>
            )}
          </div>

          {/* Website Link */}
          {provider.websiteUrl && (
            <a
              href={provider.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-info hover:underline flex items-center gap-1 mt-2"
            >
              Visit Website
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}