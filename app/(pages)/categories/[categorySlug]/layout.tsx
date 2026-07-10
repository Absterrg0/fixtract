import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serviceCategories } from "@/data/content";
import { buildMetadata } from "@/lib/seo/metadata";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/lib/seo/jsonLd";

interface Props {
  children: React.ReactNode;
  params: Promise<{ categorySlug: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }): Promise<Metadata> {
  const { categorySlug } = await params;
  const cat = serviceCategories.find((c) => c.slug === categorySlug);
  if (!cat) notFound();
  return buildMetadata({
    title: cat.name,
    description: cat.description || `Browse verified professionals offering ${cat.name.toLowerCase()} services on Fixtract.`,
    path: `/categories/${categorySlug}`,
  });
}

export default async function CategoryLayout({ children, params }: Props) {
  const { categorySlug } = await params;
  const cat = serviceCategories.find((c) => c.slug === categorySlug);
  if (!cat) notFound();
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Categories", path: "/categories" },
          { name: cat.name, path: `/categories/${categorySlug}` },
        ])}
      />
      {children}
    </>
  );
}
