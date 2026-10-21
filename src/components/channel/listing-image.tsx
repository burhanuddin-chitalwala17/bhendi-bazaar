import Image from "next/image";

/**
 * A listing's picture straight from the marketplace (channel-import Q14), theirs to host so not run
 * through our optimizer; or the product's own, which is. No picture, or not over https, is the initial.
 */
export function ListingImage({
  url,
  title,
  size = 48,
  ours = false,
}: {
  url: string | null;
  title: string | null;
  size?: 48 | 96;
  ours?: boolean;
}) {
  const box = size === 96 ? "size-24" : "size-12";
  if (url && url.startsWith("https://")) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        unoptimized={!ours}
        className={`${box} shrink-0 rounded-field border bg-muted object-contain`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`${box} flex shrink-0 items-center justify-center rounded-field bg-muted text-sm font-semibold text-muted-foreground`}
    >
      {(title ?? "?").charAt(0).toUpperCase()}
    </span>
  );
}
