/**
 * The brand's own drawings (design-system Q2, approved v2 on 2026-11-04): a soft fill, an outline,
 * a detail line and one accent part that moves. Same 256 grid as Phosphor so they sit beside it.
 * The motion CSS is in globals.css under `.bb-icon`; it runs once when `data-motion` is set.
 */
interface BrandDrawing {
  fill: string;
  line: string;
  detail?: string;
  accent?: string;
  /** The accent's own style: a gold fill, a gold stroke, or hidden at rest (it only appears in motion). */
  accentKind?: "door" | "key" | "bow" | "burst" | "glint" | "swing";
  /** The whole drawing's motion, when it is not the accent's. */
  motion?: "drop" | "pop" | "nod" | "sway" | "awn";
}

export const BRAND_ICONS = {
  bag: {
    fill: "M48,96H208L198,206A14,14,0,0,1,184,218H72A14,14,0,0,1,58,206Z",
    line: "M48,96H208L198,206A14,14,0,0,1,184,218H72A14,14,0,0,1,58,206Z",
    detail: "M62,114H194M128,128Q118,170,126,206",
    accent: "M92,96V80Q92,48,128,34Q164,48,164,80V96",
    accentKind: "swing",
    motion: "drop",
  },
  saved: {
    fill: "M128,214C62,172,34,136,34,100C34,72,56,50,84,50C104,50,120,62,128,82C136,62,152,50,172,50C200,50,222,72,222,100C222,136,194,172,128,214Z",
    line: "M128,214C62,172,34,136,34,100C34,72,56,50,84,50C104,50,120,62,128,82C136,62,152,50,172,50C200,50,222,72,222,100C222,136,194,172,128,214Z",
    detail: "M72,96Q76,78,92,74",
    accent: "M128,30V12M84,40L72,26M172,40L184,26M44,76L28,70M212,76L228,70",
    accentKind: "burst",
    motion: "pop",
  },
  home: {
    fill: "M52,216V120Q52,70,128,36Q204,70,204,120V216Z",
    line: "M52,216V120Q52,70,128,36Q204,70,204,120V216ZM32,216H224",
    detail: "M128,78a8,8,0,1,0,.1,0",
    accent: "M100,216V166Q100,138,128,128Q156,138,156,166V216Z",
    accentKind: "door",
  },
  search: {
    fill: "M112,44A68,68,0,1,1,111.9,44Z",
    line: "M112,44A68,68,0,1,1,111.9,44ZM164,164L216,216",
    accent: "M80,116Q80,86,108,78",
    accentKind: "glint",
  },
  account: {
    fill: "M128,52A38,38,0,1,1,127.9,52ZM50,218Q50,146,128,146Q206,146,206,218Z",
    line: "M128,52A38,38,0,1,1,127.9,52ZM50,218Q50,146,128,146Q206,146,206,218Z",
    detail: "M104,98Q112,112,128,112",
    motion: "nod",
  },
  rida: {
    fill: "M96,84Q96,42,128,38Q160,42,160,84L206,218H50Z",
    line: "M96,84Q96,42,128,38Q160,42,160,84L206,218H50Z",
    detail: "M112,108Q100,160,90,214M144,108Q156,160,166,214M128,118V216M104,84Q128,98,152,84",
    motion: "sway",
  },
  parcel: {
    fill: "M54,88H202A12,12,0,0,1,214,100V206A12,12,0,0,1,202,218H54A12,12,0,0,1,42,206V100A12,12,0,0,1,54,88Z",
    line: "M54,88H202A12,12,0,0,1,214,100V206A12,12,0,0,1,202,218H54A12,12,0,0,1,42,206V100A12,12,0,0,1,54,88Z",
    detail: "M128,88V218M42,146H214",
    accent: "M128,88Q100,52,88,74Q96,90,128,88Q160,90,168,74Q156,52,128,88",
    accentKind: "bow",
  },
  arch: {
    fill: "M48,224V120Q48,64,128,32Q208,64,208,120V224Z",
    line: "M48,224V120Q48,64,128,32Q208,64,208,120V224M88,224V140Q88,108,128,88Q168,108,168,140V224M32,224H224",
    detail: "M68,224V128Q70,90,104,68M188,224V128Q186,90,152,68",
    accent: "M128,58a8,8,0,1,0,.1,0",
    accentKind: "key",
  },
  shop: {
    fill: "M32,96a24,24,0,0,0,48,0a24,24,0,0,0,48,0a24,24,0,0,0,48,0a24,24,0,0,0,48,0L200,48H56Z",
    line: "M32,96L56,48H200L224,96ZM48,128V216H208V128M32,96a24,24,0,0,0,48,0a24,24,0,0,0,48,0a24,24,0,0,0,48,0a24,24,0,0,0,48,0",
    detail: "M80,96L92,48M128,96V48M176,96L164,48",
    accent: "M104,216V174Q104,150,128,146Q152,150,152,174V216",
    motion: "awn",
  },
  menu: {
    fill: "",
    line: "M40,80H216M40,176H216",
    accent: "M40,128H164",
    accentKind: "glint",
  },
} satisfies Record<string, BrandDrawing>;

export type BrandIconName = keyof typeof BRAND_ICONS;

interface BrandGlyphProps {
  name: BrandIconName;
  px: number;
  filled?: boolean;
  motion?: boolean;
  className?: string;
  label?: string;
}

/** A stroke that reads at small sizes: 16 units on the 256 grid under 20px, 12 above (Q11). */
export function BrandGlyph({ name, px, filled, motion, className, label }: BrandGlyphProps) {
  const d: BrandDrawing = BRAND_ICONS[name];
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 256 256"
      className={["bb-icon", d.motion && `bb-m-${d.motion}`, className].filter(Boolean).join(" ")}
      data-filled={filled || undefined}
      data-motion={motion || undefined}
      style={{ strokeWidth: px < 20 ? 16 : 12 }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {d.fill && <path className="bb-f" d={d.fill} />}
      <path className="bb-l" d={d.line} />
      {d.detail && <path className="bb-d" d={d.detail} />}
      {d.accent && <path className={`bb-x bb-x-${d.accentKind ?? "plain"}`} d={d.accent} />}
    </svg>
  );
}
