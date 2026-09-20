"use client";

/**
 * The row's secondary actions — today, just Delete.
 *
 * Delete sat inline beside Archive, one `gap-2` from a control an org uses routinely,
 * and it is the only irreversible thing on the row. Behind a deliberate second step it
 * stops being a mis-tap, and the dialog can say in prose what deletion actually means
 * and which action to reach for instead — which a native `confirm()` cannot format and
 * an icon with a tooltip cannot say at all.
 *
 * A dialog rather than a dropdown: `Dialog` is already a dependency, brings focus
 * handling and Escape with it, and reads better than a floating menu at 360px
 * (ADR-0015).
 */

import { useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProductRowMenuProps {
  product: { id: string; name: string; archivedAt: Date | null };
  onDelete: (id: string, name: string) => void;
  disabled: boolean;
}

export function ProductRowMenu({
  product,
  onDelete,
  disabled,
}: ProductRowMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          title="More actions"
        >
          <MoreHorizontal className="w-4 h-4" />
          <span className="sr-only">More actions for {product.name}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-overlay overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>
            Deleting is permanent and cannot be undone. It only works for a
            product nothing refers to yet — once it appears on an order, a
            promotion or a bidding event it is refused, because removing it
            would break those records. To take a product off the storefront
            instead, use Archive: it keeps everything and can be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              onDelete(product.id, product.name);
            }}
          >
            <Trash2 className="w-4 h-4" />
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
