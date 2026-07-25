'use client';

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  hasAdminPermission,
  permissionForAdminPage,
  type AdminPermission,
} from '@/lib/adminRbac';

export function useAdminAccess() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';
  const adminRole = user?.adminRole || (isAdmin ? 'super' : undefined);
  const permissions = user?.adminPermissions || [];

  const can = useMemo(() => {
    return (permission: AdminPermission) => {
      if (!isAdmin) return false;
      // Legacy sessions without permissions payload → treat as super until refresh
      if (!user?.adminPermissions) return true;
      return hasAdminPermission(permissions, permission);
    };
  }, [isAdmin, permissions, user?.adminPermissions]);

  const canAccessPath = (pathname: string) => {
    if (!isAdmin) return false;
    const required = permissionForAdminPage(pathname);
    if (!required) return true;
    return can(required);
  };

  return { isAdmin, adminRole, permissions, can, canAccessPath };
}
