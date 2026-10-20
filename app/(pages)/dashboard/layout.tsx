import type { Metadata } from "next";
import { noindexMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = noindexMetadata("/dashboard", "Dashboard");

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
