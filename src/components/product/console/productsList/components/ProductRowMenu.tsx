"use client";

/**
 * Every action on a product row, behind one ⋯ trigger.
 *
 * Delete is the only irreversible item, so choosing it opens a confirmation that says
 * in prose what deletion means and which action to reach for instead — something a
 * native `confirm()` cannot format and an icon with a tooltip cannot say at all.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProductRowMenuProps {
  product: { id: string; name: string; archivedAt: Date | null };
  productsBasePath: string;
  onSetArchived: (id: string, archived: boolean, name: string) => void;
  onDelete: (id: string, name: string) => void;
  disabled: boolean;
}

export function ProductRowMenu({
  product,
  productsBasePath,
  onSetArchived,
  onDelete,
  disabled,
}: ProductRowMenuProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      {/* Non-modal: a modal menu handing off to the delete Dialog can leave the body's
          pointer-events lock behind, freezing the page after the dialog closes. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            shape="icon"
            aria-label={`Actions for ${product.name}`}
          >
            <Icon name="more" size="sm" />
          </Button>
        </DropdownMenuTrigger>

        {/* Prefetch off: a listing puts one menu per row in view, and each link would
            fetch an auth re-read plus the product tree, all of it discarded. */}
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link prefetch={false} href={`${productsBasePath}/${product.id}`}>
              <Icon name="show" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              prefetch={false}
              href={`${productsBasePath}/${product.id}/edit`}
            >
              <Icon name="edit" />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              prefetch={false}
              href={`${productsBasePath}/new?copyFrom=${encodeURIComponent(product.id)}`}
            >
              <Icon name="copy" />
              Copy product
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              onSetArchived(product.id, !product.archivedAt, product.name)
            }
          >
            <Icon name={product.archivedAt ? "restore" : "archive"} />
            {product.archivedAt ? "Restore" : "Archive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmingDelete(true)}
          >
            <Icon name="delete" />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
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
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              pending={disabled}
              onClick={() => {
                setConfirmingDelete(false);
                onDelete(product.id, product.name);
              }}
            >
              <Icon name="delete" size="sm" />
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
