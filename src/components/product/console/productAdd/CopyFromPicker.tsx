"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronDown, Copy, FilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProductCopyOption } from "@server/catalog/admin.product.types";

interface CopyFromPickerProps {
  options: ProductCopyOption[];
  /** The product currently copied from, if any — marked, and offered a way back to blank. */
  selectedId?: string;
  newProductPath: string;
}

/**
 * Picking a product navigates to `?copyFrom=<id>` rather than fetching: the page reads
 * the source on the server and scopes it to the org, so no route handler is needed.
 */
export function CopyFromPicker({
  options,
  selectedId,
  newProductPath,
}: CopyFromPickerProps) {
  const router = useRouter();

  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Copy />
          Copy from product
          <ChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>
          Copies description, category, attributes and flags
        </DropdownMenuLabel>
        {selectedId && (
          <>
            <DropdownMenuItem onSelect={() => router.push(newProductPath)}>
              <FilePlus />
              Start blank instead
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onSelect={() =>
              router.push(
                `${newProductPath}?copyFrom=${encodeURIComponent(option.id)}`,
              )
            }
          >
            <span className="min-w-0 flex-1 truncate">{option.name}</span>
            {option.sku && (
              <span className="font-mono text-xs text-muted-foreground">
                {option.sku}
              </span>
            )}
            {option.id === selectedId && <Check />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
