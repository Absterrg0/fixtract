export const ADMIN_ROLES = ['super', 'care', 'marketing', 'quality', 'finance'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminPermission =
  | 'staff.manage'
  | 'dashboard.overview'
  | 'professionals.approve'
  | 'professionals.manage'
  | 'customers.manage'
  | 'bookings.read'
  | 'bookings.write'
  | 'disputes.manage'
  | 'cancellations.manage'
  | 'chat.support'
  | 'chat.reports'
  | 'support.tickets'
  | 'payments.manage'
  | 'kpi.read'
  | 'audit.read'
  | 'email_logs.read'
  | 'cms.manage'
  | 'discounts.manage'
  | 'loyalty.manage'
  | 'referrals.manage'
  | 'backlinks.manage'
  | 'reviews.moderate'
  | 'favorites.manage'
  | 'services.manage'
  | 'projects.approve'
  | 'warranty.manage'
  | 'settings.platform'
  | 'settings.site'
  | 'maintenance.run'
  | 'users.delete';

/** Path → permission for client-side route gating (keep aligned with server routePermissions). */
export const ADMIN_PAGE_PERMISSIONS: Array<{ prefix: string; permission: AdminPermission }> = [
  { prefix: '/admin/staff', permission: 'staff.manage' },
  { prefix: '/admin/professionals/manage', permission: 'professionals.manage' },
  { prefix: '/admin/professionals', permission: 'professionals.approve' },
  { prefix: '/admin/customers', permission: 'customers.manage' },
  { prefix: '/admin/bookings', permission: 'bookings.read' },
  { prefix: '/admin/disputes', permission: 'disputes.manage' },
  { prefix: '/admin/cancellation-requests', permission: 'cancellations.manage' },
  { prefix: '/admin/chat-reports', permission: 'chat.reports' },
  { prefix: '/admin/chat', permission: 'chat.support' },
  { prefix: '/admin/support', permission: 'support.tickets' },
  { prefix: '/admin/payments', permission: 'payments.manage' },
  { prefix: '/admin/kpi', permission: 'kpi.read' },
  { prefix: '/admin/audit-logs', permission: 'audit.read' },
  { prefix: '/admin/cms', permission: 'cms.manage' },
  { prefix: '/admin/discount-codes', permission: 'discounts.manage' },
  { prefix: '/admin/loyalty', permission: 'loyalty.manage' },
  { prefix: '/admin/professional-levels', permission: 'loyalty.manage' },
  { prefix: '/admin/referral', permission: 'referrals.manage' },
  { prefix: '/admin/backlinks', permission: 'backlinks.manage' },
  { prefix: '/admin/favorites', permission: 'favorites.manage' },
  { prefix: '/admin/reviews', permission: 'reviews.moderate' },
  { prefix: '/admin/services', permission: 'services.manage' },
  { prefix: '/admin/projects', permission: 'projects.approve' },
  { prefix: '/admin/warranty-claims', permission: 'warranty.manage' },
  { prefix: '/admin/settings', permission: 'settings.platform' },
  { prefix: '/admin/site-announcements', permission: 'cms.manage' },
];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super: 'Super admin',
  care: 'Customer care',
  marketing: 'Marketing',
  quality: 'Quality',
  finance: 'Finance',
};

/** Human-readable admin areas each role can open (keep aligned with server ROLE_PERMISSIONS). */
export const ADMIN_ROLE_ACCESS: Record<AdminRole, string[]> = {
  super: [
    'Everything below',
    'Staff & roles',
    'Platform / site settings',
    'Maintenance jobs',
    'User delete / anonymize',
  ],
  care: [
    'Bookings',
    'Disputes',
    'Cancellations',
    'Support chat',
    'Support tickets',
    'Chat reports',
    'Customers',
    'Warranty claims',
  ],
  marketing: [
    'CMS',
    'Discount codes',
    'Loyalty & points',
    'Referrals',
    'Backlinks',
    'Favorites',
  ],
  quality: [
    'Professional approvals',
    'Professional management',
    'Project approvals',
    'Review moderation',
    'Chat reports',
    'Warranty claims',
    'Services',
  ],
  finance: [
    'Payments',
    'KPI dashboard',
    'Audit logs',
    'Email logs',
    'Bookings (read only)',
  ],
};

/** Area → roles matrix derived from ADMIN_ROLE_ACCESS (single source of truth). */
export const ADMIN_ACCESS_MATRIX: Array<{ area: string; roles: AdminRole[] }> = (() => {
  const byArea = new Map<string, Set<AdminRole>>();
  for (const role of ADMIN_ROLES) {
    for (const area of ADMIN_ROLE_ACCESS[role]) {
      if (area === 'Everything below') continue;
      if (!byArea.has(area)) byArea.set(area, new Set<AdminRole>(['super']));
      byArea.get(area)!.add(role);
    }
  }
  return Array.from(byArea.entries()).map(([area, roles]) => ({
    area,
    roles: ADMIN_ROLES.filter((r) => roles.has(r)),
  }));
})();

export function permissionForAdminPage(pathname: string): AdminPermission | null {
  const match = ADMIN_PAGE_PERMISSIONS.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
  );
  return match?.permission ?? null;
}

export function hasAdminPermission(
  permissions: AdminPermission[] | undefined | null,
  permission: AdminPermission
): boolean {
  return Boolean(permissions?.includes(permission));
}
