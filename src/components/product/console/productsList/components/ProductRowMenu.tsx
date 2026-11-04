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
import { PRODUCT_CONSOLE_COPY } from "../../console-copy";

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
            aria-label={PRODUCT_CONSOLE_COPY.rowMenu.actionsFor(product.name)}
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
              {PRODUCT_CONSOLE_COPY.rowMenu.view}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              prefetch={false}
              href={`${productsBasePath}/${product.id}/edit`}
            >
              <Icon name="edit" />
              {PRODUCT_CONSOLE_COPY.rowMenu.edit}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link
              prefetch={false}
              href={`${productsBasePath}/new?copyFrom=${encodeURIComponent(product.id)}`}
            >
              <Icon name="copy" />
              {PRODUCT_CONSOLE_COPY.rowMenu.copy}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              onSetArchived(product.id, !product.archivedAt, product.name)
            }
          >
            <Icon name={product.archivedAt ? "restore" : "archive"} />
            {product.archivedAt ? PRODUCT_CONSOLE_COPY.rowMenu.restore : PRODUCT_CONSOLE_COPY.rowMenu.archive}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmingDelete(true)}
          >
            <Icon name="delete" />
            {PRODUCT_CONSOLE_COPY.rowMenu.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="max-h-overlay overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{product.name}</DialogTitle>
            <DialogDescription>
              {PRODUCT_CONSOLE_COPY.rowMenu.deleteBody}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
            >
              {PRODUCT_CONSOLE_COPY.rowMenu.cancel}
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
              {PRODUCT_CONSOLE_COPY.rowMenu.deletePermanently}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
