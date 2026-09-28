import { SHOT_ROLE, type ShotRole } from "@server/catalog/shot-list";
import { cn } from "@/lib/utils";

interface SlotSilhouetteProps {
  role: ShotRole;
  className?: string;
}

/**
 * What an empty slot wants, as a picture (media-library R8, D6): a product shot is a centred
 * shape on a plain field, a label is a rectangle with lines to read, a lifestyle shot is a
 * thing in a scene. Drawn in `currentColor` so it takes the muted token and nothing else.
 */
export function SlotSilhouette({ role, className }: SlotSilhouetteProps) {
  return (
    <svg
      viewBox="0 0 96 72"
      aria-hidden
      className={cn("size-16 shrink-0 text-muted-foreground", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {role === SHOT_ROLE.LABEL ? (
        <>
          <rect x={16} y={10} width={64} height={52} rx={4} />
          <path d="M28 26h40M28 38h40M28 50h24" strokeWidth={3} />
        </>
      ) : role === SHOT_ROLE.LIFESTYLE ? (
        <>
          <path d="M4 50h88" />
          <circle cx={76} cy={18} r={6} fill="currentColor" fillOpacity={0.25} />
          <rect x={36} y={24} width={24} height={26} rx={6} fill="currentColor" fillOpacity={0.25} />
        </>
      ) : (
        <>
          <rect x={4} y={4} width={88} height={64} rx={6} fill="currentColor" fillOpacity={0.06} />
          <rect x={30} y={16} width={36} height={40} rx={10} fill="currentColor" fillOpacity={0.25} />
        </>
      )}
    </svg>
  );
}
