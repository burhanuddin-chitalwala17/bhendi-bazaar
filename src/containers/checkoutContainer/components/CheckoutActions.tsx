// src/containers/checkoutContainer/components/CheckoutActions.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CreditCard, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CheckoutActionsProps {
  canCheckout: boolean;
  isProcessing: boolean;
  total: number;
  onCheckout: () => void;
  validationErrors: string[];
  error: string | null;
}

export function CheckoutActions({
  canCheckout,
  isProcessing,
  total,
  onCheckout,
  validationErrors,
  error,
}: CheckoutActionsProps) {
  return (
    <div className="space-y-4">
      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* General Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Checkout Button */}
      <Button
        onClick={onCheckout}
        disabled={!canCheckout || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Place Order • {formatCurrency(total)}
          </>
        )}
      </Button>

      {/* Helper text */}
      {!canCheckout && validationErrors.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Complete all required fields to proceed
        </p>
      )}
    </div>
  );
}
