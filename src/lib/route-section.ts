/**
 * The section a ROUTES builder's pages sit under: `ROUTES.category("")` is `/category/`, its
 * section `/category`. For "is this path in that part of the site" checks, so the prefix comes
 * from the same table as the links (ADR-0067).
 */
export const routeSection = (path: string): string => path.replace(/\/+$/, "") || "/";

/** True when `pathname` is `section` itself or a page under it. */
export const isUnder = (pathname: string, section: string): boolean =>
  pathname === section || pathname.startsWith(`${section}/`);
