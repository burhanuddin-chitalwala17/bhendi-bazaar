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

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; offers?: string }>;
}

/** The filters a category offers; each is one the listing route already carries forward. */
const FILTERS: ListingFilter[] = [{ label: "On offer", param: "offers", value: "1" }];

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

  const url = `${appUrl()}/category/${category.slug}`;
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
          { name: "Home", path: "/" },
          ...[...ancestors, category].map((c) => ({ name: c.name, path: `/category/${c.slug}` })),
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
        basePath={`/category/${category.slug}`}
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
          title="Nothing here is on offer right now"
          description="Every piece in this category is at its usual price today."
          action={{ label: "Show everything", href: `/category/${category.slug}` }}
        />
      ) : (
        <EmptyState
          title="No pieces in this category yet"
          description="Shops add new pieces every week. Browse the rest of the bazaar meanwhile."
          action={{ label: "Browse the shop", href: "/shop" }}
        />
      )}
    </div>
  );
}
