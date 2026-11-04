import Link from "next/link";

import { Button } from "@/components/ui/button";

/** A state's one way forward: a link a server page can pass, or a click from a client one. */
export type StateAction = { label: string; href: string } | { label: string; onClick: () => void };

export function StateActionButton({ action }: { action: StateAction }) {
  if ("href" in action) {
    return (
      <Button asChild variant="outline" className="min-h-10">
        <Link href={action.href} prefetch={false}>
          {action.label}
        </Link>
      </Button>
    );
  }
  return (
    <Button variant="outline" className="min-h-10" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
