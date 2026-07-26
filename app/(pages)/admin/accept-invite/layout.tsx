import type { Metadata } from 'next';
import { noindexMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = noindexMetadata(
  '/admin/accept-invite',
  'Accept admin invite'
);

export default function AdminAcceptInviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
