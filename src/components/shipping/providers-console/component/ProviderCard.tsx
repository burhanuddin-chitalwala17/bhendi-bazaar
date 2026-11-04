"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import type { ShippingProvider } from "../types";
import Image from "next/image";

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
                /* A carrier's own logo, hotlinked from their site by the
                   register_shiprocket_provider migration. Unoptimized because it is a
                   third party's already-sized asset: optimizing spends a transformation
                   to save bytes that are not ours (ADR-0026). */
                <Image
                  src={provider.logoUrl}
                  alt={provider.name}
                  width={32}
                  height={32}
                  unoptimized
                />
              )}
              <h3 className="text-title font-semibold">{provider.name}</h3>
            </div>
            <StatusBadge tone={provider.isConnected ? "success" : "neutral"} dot>
              {provider.isConnected ? "Connected" : "Not connected"}
            </StatusBadge>
          </div>

          {/* Description */}
          {provider.description && (
            <p className="text-small text-muted-foreground mt-2">
              {provider.description}
            </p>
          )}

          {/* Connection Status */}
          <div className="mt-3">
            {provider.isConnected ? (
              <div className="space-y-2">
                {provider.accountInfo && "email" in provider.accountInfo ? (
                  <p className="text-caption text-muted-foreground">
                    {provider.accountInfo.email as string}
                  </p>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDisconnect}
                  pending={isDisconnecting}
                >
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={onConnect} pending={isConnecting}>
                Connect account
              </Button>
            )}
          </div>

          {/* Website Link */}
          {provider.websiteUrl && (
            <a
              href={provider.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-10 items-center gap-1 text-small text-info hover:underline"
            >
              Visit website
              <Icon name="external" size="xs" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
