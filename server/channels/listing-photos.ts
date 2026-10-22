/**
 * Which photo addresses a copy may fetch (product-merge D6): https on Amazon's image hosts, at most
 * nine. The addresses come from the marketplace's own answer, never from a request.
 */
export const MAX_COPIED_PHOTOS = 9;

const AMAZON_IMAGE_HOSTS = [/^m\.media-amazon\.com$/, /\.ssl-images-amazon\.com$/, /^images-amazon\.com$/];

export function isMarketplacePhotoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && AMAZON_IMAGE_HOSTS.some((host) => host.test(parsed.hostname));
  } catch {
    return false;
  }
}

export function copyablePhotos(urls: readonly string[]): string[] {
  return urls.filter(isMarketplacePhotoUrl).slice(0, MAX_COPIED_PHOTOS);
}
