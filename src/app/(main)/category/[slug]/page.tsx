import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryBreadcrumb } from "@/components/category/category-breadcrumb";
import { CategoryHero } from "@/components/category/category-hero";
import { CategoryLanes } from "@/components/category/category-lanes";
import { PaginatedProductGrid } from "@/components/shared/paginated-product-grid";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { Package } from "lucide-react";
import { productsDAL } from "@/data-access-layer/products.dal";
import { categoriesDAL } from "@/data-access-layer/categories.dal";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { appUrl } from "@server/shared/app-url";
import { NotFoundError } from "@server/shared/domain-error";
import { JsonLd } from "@/components/shared/JsonLd";
import { breadcrumbJsonLd } from "@/lib/structured-data";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

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

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  // Independent reads, fetched together rather than in a four-step waterfall. The three
  // category shapes all resolve against the same request-memoised tree, so they add no
  // queries; lanes are below this one only, and the ancestor trail points back up.
  const [category, page, lanes, ancestors] = await Promise.all([
    getCategory(slug),
    productsDAL.getPage({ categorySlug: slug }),
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
      <CategoryHero category={category} />
      <CategoryLanes categories={lanes} />
      {page.products.length > 0 ? (
          <PaginatedProductGrid
            initial={page.products}
            initiallyDone={page.done}
            query={{ category: slug }}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No products in this category yet"
            description="Browse the other categories meanwhile"
          />
        )}
    </div>
  );
}
