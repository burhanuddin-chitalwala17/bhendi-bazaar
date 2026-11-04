import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryBreadcrumb } from "@/components/category/category-breadcrumb";
import { CategoryLanes } from "@/components/category/category-lanes";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { PageHeader } from "@/components/shared/page-shell";
import { ListingToolbar, countLabel, parseSort, type ListingFilter } from "@/components/shared/listing-toolbar";
import { productsDAL } from "@/data-access-layer/products.dal";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { appUrl } from "@server/shared/app-url";
import { NotFoundError } from "@server/shared/domain-error";
import { JsonLd } from "@/components/shared/JsonLd";
import { breadcrumbJsonLd } from "@/lib/structured-data";
import { CATEGORY_PAGE_COPY } from "./category-page-copy";
import { ROUTES } from "@server/shared/routes";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; offers?: string }>;
}

/** The filters a category offers; each is one the listing route already carries forward. */
const FILTERS: ListingFilter[] = [{ label: CATEGORY_PAGE_COPY.onOfferFilter, param: "offers", value: "1" }];

/** An unknown slug is a 404, never an empty page that answers 200 (seo R7). */
const getCategory = (slug: string) =>
  categoriesDAL.getCategoryBySlug(slug).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);

  const url = `${appUrl()}${ROUTES.category(category.slug)}`;
  const title = category.name;
  const socialTitle = `${category.name} — ${APP_NAME}`;
  const description = category.description?.trim().slice(0, 200) || APP_DESCRIPTION;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: APP_NAME,
      title: socialTitle,
      description,
      ...(category.heroImage ? { images: [{ url: category.heroImage, alt: category.name }] } : {}),
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const sort = parseSort(query.sort);
  const offersOnly = query.offers === "1";
  const filter = { categorySlug: slug, offerOnly: offersOnly };

  // Independent reads, together; the category shapes share one request-memoised tree.
  const [category, page, count, lanes, ancestors] = await Promise.all([
    getCategory(slug),
    productsDAL.getPage(filter, { sort }),
    productsDAL.countListing(filter),
    categoriesDAL.getDescendants(slug),
    categoriesDAL.getAncestors(slug),
  ]);

  return (
    <div className="space-y-4">
      <JsonLd
        data={breadcrumbJsonLd(appUrl(), [
          { name: CATEGORY_PAGE_COPY.breadcrumbHome, path: ROUTES.home },
          ...[...ancestors, category].map((c) => ({ name: c.name, path: ROUTES.category(c.slug) })),
        ])}
      />
      <CategoryBreadcrumb ancestors={ancestors} current={category} />
      <PageHeader
        title={category.name}
        description={category.description || undefined}
        actions={<p className="text-small tabular-nums text-muted-foreground" aria-live="polite">{countLabel(count)}</p>}
      />
      <CategoryLanes categories={lanes} />
      <ListingToolbar
        basePath={ROUTES.category(category.slug)}
        params={{ sort: sort === "newest" ? undefined : sort, offers: offersOnly ? "1" : undefined }}
        filters={FILTERS}
      />
      {page.products.length > 0 ? (
        <PaginatedProductGrid
          initial={page.products}
          initiallyDone={page.done}
          total={count}
          query={{ category: slug, offersOnly, sort }}
        />
      ) : offersOnly ? (
        <EmptyState
          title={CATEGORY_PAGE_COPY.noOffersTitle}
          description={CATEGORY_PAGE_COPY.noOffersBody}
          action={{ label: CATEGORY_PAGE_COPY.showEverything, href: ROUTES.category(category.slug) }}
        />
      ) : (
        <EmptyState
          title={CATEGORY_PAGE_COPY.emptyTitle}
          description={CATEGORY_PAGE_COPY.emptyBody}
          action={{ label: CATEGORY_PAGE_COPY.browseShop, href: ROUTES.shopAll }}
        />
      )}
    </div>
  );
}
