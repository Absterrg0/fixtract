import type { Metadata } from "next";
import { noindexMetadata } from "@/lib/seo/metadata";
import AdminAccessGate from "@/components/admin/AdminAccessGate";

export const metadata: Metadata = noindexMetadata("/admin", "Admin");

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAccessGate>{children}</AdminAccessGate>;
}
