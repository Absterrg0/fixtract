'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import type { AdminPermission } from '@/lib/adminRbac';

export function RequireAdminPermission({
  permission,
  children,
  fallbackPath = '/dashboard',
}: {
  permission: AdminPermission;
  children: React.ReactNode;
  fallbackPath?: string;
}) {
  const { loading, isAuthenticated } = useAuth();
  const { isAdmin, can } = useAdminAccess();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !isAdmin) {
      router.replace(`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/dashboard')}`);
      return;
    }
    if (!can(permission)) {
      router.replace(fallbackPath);
    }
  }, [loading, isAuthenticated, isAdmin, can, permission, router, fallbackPath]);

  if (loading || !isAuthenticated || !isAdmin || !can(permission)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
