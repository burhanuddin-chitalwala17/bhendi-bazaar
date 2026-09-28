import { SectionHeader } from "@/components/shared/SectionHeader";
import { Badge } from "@/components/ui/badge";

/**
 * The brands a shop carries, names only (brand-page R10, D8). The service already withheld
 * everything else about a brand and the section for a shop with one, so this is a row of
 * chips and nothing to decide.
 */
export function BrandsCarried({ names }: { names: string[] }) {
  return (
    <section className="space-y-3">
      <SectionHeader overline="The shop" title="Brands they carry" />
      <ul className="flex flex-wrap gap-2">
        {names.map((name) => (
          <li key={name}>
            <Badge variant="outline" className="border-border px-3 py-1 text-sm">
              {name}
            </Badge>
          </li>
        ))}
      </ul>
    </section>
  );
}
