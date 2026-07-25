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
  // Do not invent 'super' — missing role means incomplete session payload
  const adminRole = user?.adminRole;
  const permissions = user?.adminPermissions;

  const can = useMemo(() => {
    return (permission: AdminPermission) => {
      if (!isAdmin) return false;
      // Fail closed: missing permissions payload must not grant all access.
      // Explicit super may keep a legacy fallback until /me refreshes the pack.
      if (!permissions) {
        return user?.adminRole === 'super';
      }
      return hasAdminPermission(permissions, permission);
    };
  }, [isAdmin, permissions, user?.adminRole]);

  const canAccessPath = (pathname: string) => {
    if (!isAdmin) return false;
    const required = permissionForAdminPage(pathname);
    if (!required) return true;
    return can(required);
  };

  return { isAdmin, adminRole, permissions: permissions || [], can, canAccessPath };
}
