'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { RequireAdminPermission } from '@/components/admin/RequireAdminPermission';
import {
  ADMIN_ACCESS_MATRIX,
  ADMIN_ROLE_ACCESS,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLES,
  type AdminRole,
} from '@/lib/adminRbac';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, Copy, Loader2 } from 'lucide-react';
import { messageFromApiBody, readJsonResponse } from '@/lib/apiErrors';

type StaffMember = {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  adminRole: AdminRole;
  accountStatus: string;
  invitePending?: boolean;
  inviteExpired?: boolean;
  permissions: string[];
  createdAt?: string;
};

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

function authInit(init?: RequestInit): RequestInit {
  return {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  };
}

function StaffPageInner() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [adminRole, setAdminRole] = useState<AdminRole>('care');
  const [submitting, setSubmitting] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);

  const setRowBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/staff`, authInit());
      const json = await readJsonResponse<{ data?: StaffMember[] }>(res);
      if (!res.ok || !json.success) {
        throw new Error(messageFromApiBody(json, 'Failed to load staff'));
      }
      setStaff(json.data || []);
    } catch (err: unknown) {
      if (!silent) toast.error(err instanceof Error ? err.message : 'Failed to load staff');
      throw err;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const applyInviteResponse = (
    json: {
      data?: StaffMember;
      inviteUrl?: string;
      emailSent?: boolean;
      emailError?: string;
      resent?: boolean;
      msg?: string;
    }
  ) => {
    // Only surface the bearer invite URL when email delivery failed
    setLastInviteUrl(json.emailSent ? null : json.inviteUrl || null);
    if (json.emailSent) {
      toast.success(
        json.resent
          ? `Invite resent to ${json.data?.email}`
          : `Invite email sent to ${json.data?.email}`
      );
    } else {
      toast.warning(json.msg || `Invite ready for ${json.data?.email} — email was not sent`);
      if (json.emailError) {
        toast.message(json.emailError, { duration: 8000 });
      }
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLastInviteUrl(null);
    try {
      const res = await fetch(
        `${API}/api/admin/staff`,
        authInit({
          method: 'POST',
          body: JSON.stringify({ name, email, phone: phone || undefined, adminRole }),
        })
      );
      const json = await readJsonResponse<{
        success?: boolean;
        msg?: string;
        field?: 'email' | 'phone' | 'name';
        inviteUrl?: string;
        emailSent?: boolean;
        emailError?: string;
        resent?: boolean;
        data?: StaffMember;
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(messageFromApiBody(json, `Invite failed (${res.status})`));
      }
      applyInviteResponse(json);
      setName('');
      setEmail('');
      setPhone('');
      setAdminRole('care');
      if (json.data) {
        const member = json.data;
        setStaff((prev) => {
          const exists = prev.some((m) => m._id === member._id);
          return exists ? prev.map((m) => (m._id === member._id ? member : m)) : [member, ...prev];
        });
      } else {
        await load({ silent: true });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setSubmitting(false);
    }
  };

  const updateRole = async (staffId: string, nextRole: AdminRole) => {
    const previous = staff.find((m) => m._id === staffId);
    if (!previous || previous.adminRole === nextRole) return;

    setRowBusy(staffId, true);
    setStaff((prev) =>
      prev.map((m) => (m._id === staffId ? { ...m, adminRole: nextRole } : m))
    );

    try {
      const res = await fetch(
        `${API}/api/admin/staff/${staffId}`,
        authInit({ method: 'PATCH', body: JSON.stringify({ adminRole: nextRole }) })
      );
      const json = await readJsonResponse<{ data?: StaffMember }>(res);
      if (!res.ok || !json.success) {
        throw new Error(messageFromApiBody(json, 'Update failed'));
      }
      if (json.data) {
        const updated = json.data;
        setStaff((prev) => prev.map((m) => (m._id === staffId ? { ...m, ...updated } : m)));
      }
      toast.success('Role updated');
    } catch (err: unknown) {
      setStaff((prev) => prev.map((m) => (m._id === staffId ? previous : m)));
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setRowBusy(staffId, false);
    }
  };

  const resendInvite = async (member: StaffMember) => {
    setRowBusy(member._id, true);
    try {
      const res = await fetch(
        `${API}/api/admin/staff/${member._id}/resend-invite`,
        authInit({ method: 'POST' })
      );
      const json = await readJsonResponse<{
        data?: StaffMember;
        inviteUrl?: string;
        emailSent?: boolean;
        emailError?: string;
        resent?: boolean;
        msg?: string;
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(messageFromApiBody(json, 'Resend failed'));
      }
      applyInviteResponse(json);
      if (json.data) {
        setStaff((prev) => prev.map((m) => (m._id === member._id ? { ...m, ...json.data } : m)));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Resend failed');
    } finally {
      setRowBusy(member._id, false);
    }
  };

  const toggleStatus = async (member: StaffMember) => {
    const next = member.accountStatus === 'active' ? 'suspended' : 'active';
    const previousStatus = member.accountStatus;

    setRowBusy(member._id, true);
    setStaff((prev) =>
      prev.map((m) => (m._id === member._id ? { ...m, accountStatus: next } : m))
    );

    try {
      const res = await fetch(
        `${API}/api/admin/staff/${member._id}`,
        authInit({ method: 'PATCH', body: JSON.stringify({ accountStatus: next }) })
      );
      const json = await readJsonResponse<{
        data?: StaffMember;
        inviteUrl?: string;
        emailSent?: boolean;
        emailError?: string;
        resent?: boolean;
        msg?: string;
      }>(res);
      if (!res.ok || !json.success) {
        throw new Error(messageFromApiBody(json, 'Update failed'));
      }
      if (json.data) {
        setStaff((prev) =>
          prev.map((m) => (m._id === member._id ? { ...m, ...json.data } : m))
        );
      }
      toast.success(next === 'active' ? 'Staff reactivated' : 'Staff suspended');
    } catch (err: unknown) {
      setStaff((prev) =>
        prev.map((m) =>
          m._id === member._id ? { ...m, accountStatus: previousStatus } : m
        )
      );
      toast.error(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setRowBusy(member._id, false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 pt-24 pb-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">Staff & roles</h1>
          <p className="mt-1 text-sm text-slate-600">
            Invite team members and assign care, marketing, quality, or finance access. Signed in as{' '}
            {user?.name}.
          </p>
        </div>

        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg">Invite staff</CardTitle>
            <CardDescription>
              Fill in their details, pick a role, then send the invite. They&apos;ll get an email with a
              link to set their password.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={invite} className="grid gap-8 lg:grid-cols-2">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Contact details
                </p>
                <div className="space-y-2">
                  <Label htmlFor="staff-name">Name</Label>
                  <Input
                    id="staff-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Johnson"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-email">Email</Label>
                  <Input
                    id="staff-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@fixtract.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staff-phone">Phone (optional)</Label>
                  <Input
                    id="staff-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+32 …"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inviting…
                      </>
                    ) : (
                      'Invite admin'
                    )}
                  </Button>
                  {lastInviteUrl ? (
                    <div className="inline-flex h-9 max-w-full items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-sm text-blue-950">
                      <span className="truncate">Invite link ready</span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(lastInviteUrl);
                            toast.success('Invite link copied');
                          } catch {
                            toast.error('Could not copy');
                          }
                        }}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-blue-900 hover:bg-blue-100"
                        aria-label="Copy invite link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role & access
                </p>
                <div className="space-y-2" role="radiogroup" aria-label="Admin role">
                  {ADMIN_ROLES.map((role) => {
                    const selected = adminRole === role;
                    return (
                      <button
                        key={role}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setAdminRole(role)}
                        className={
                          selected
                            ? 'flex w-full items-start gap-3 rounded-lg border border-slate-900 bg-slate-900 px-3 py-2.5 text-left text-white'
                            : 'flex w-full items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                        }
                      >
                        <span
                          className={
                            selected
                              ? 'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-white'
                              : 'mt-0.5 flex h-4 w-4 shrink-0 rounded-full border-2 border-slate-300'
                          }
                          aria-hidden
                        >
                          {selected ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{ADMIN_ROLE_LABELS[role]}</span>
                          <span
                            className={
                              selected
                                ? 'mt-0.5 block text-xs text-slate-300'
                                : 'mt-0.5 block text-xs text-slate-500'
                            }
                          >
                            {ADMIN_ROLE_ACCESS[role].slice(0, 3).join(' · ')}
                            {ADMIN_ROLE_ACCESS[role].length > 3
                              ? ` · +${ADMIN_ROLE_ACCESS[role].length - 3} more`
                              : ''}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Team</CardTitle>
            <CardDescription>
              {loading ? 'Loading…' : `${staff.length} admin account${staff.length === 1 ? '' : 's'}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-slate-500">Loading staff…</p>
            ) : staff.length === 0 ? (
              <p className="text-sm text-slate-500">No staff accounts yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Name</th>
                      <th className="px-3 py-2.5 font-medium">Email</th>
                      <th className="px-3 py-2.5 font-medium">Role</th>
                      <th className="px-3 py-2.5 text-center font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y bg-white">
                    {staff.map((member) => {
                      const isSelf = member._id === user?._id;
                      const rowBusy = busyIds.has(member._id);
                      return (
                        <tr key={member._id} className="hover:bg-slate-50/80">
                          <td className="px-3 py-3 font-medium text-slate-900">
                            {member.name}
                            {isSelf ? (
                              <span className="ml-2 text-xs font-normal text-slate-400">you</span>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 text-slate-600">{member.email}</td>
                          <td className="px-3 py-3">
                            <Select
                              value={member.adminRole}
                              onValueChange={(v) => updateRole(member._id, v as AdminRole)}
                              disabled={isSelf || rowBusy}
                            >
                              <SelectTrigger className="h-8 w-[150px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ADMIN_ROLES.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {ADMIN_ROLE_LABELS[role]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <Badge
                              variant={
                                member.accountStatus === 'active'
                                  ? 'secondary'
                                  : member.accountStatus === 'pending' ||
                                      member.accountStatus === 'invite_expired'
                                    ? 'outline'
                                    : 'destructive'
                              }
                              className="font-normal capitalize"
                            >
                              {member.accountStatus === 'invite_expired'
                                ? 'Invite expired'
                                : member.accountStatus}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-right">
                            {member.accountStatus !== 'suspended' &&
                            member.accountStatus !== 'rejected' &&
                            (member.invitePending ||
                              member.inviteExpired ||
                              member.accountStatus === 'pending' ||
                              member.accountStatus === 'invite_expired') ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resendInvite(member)}
                                disabled={isSelf || rowBusy}
                              >
                                Resend invite
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => toggleStatus(member)}
                                disabled={isSelf || rowBusy}
                              >
                                {member.accountStatus === 'active' ? 'Suspend' : 'Reactivate'}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Role access overview</CardTitle>
            <CardDescription>
              Quick reference for what each role can open in admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-y bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Admin area</th>
                  {ADMIN_ROLES.map((role) => (
                    <th key={role} className="px-3 py-2.5 text-center font-medium">
                      {ADMIN_ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {ADMIN_ACCESS_MATRIX.map((row) => (
                  <tr key={row.area} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 text-slate-800">{row.area}</td>
                    {ADMIN_ROLES.map((role) => (
                      <td key={role} className="px-3 py-2.5 text-center">
                        {row.roles.includes(role) ? (
                          <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Yes" />
                        ) : (
                          <span className="text-slate-300" aria-label="No">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminStaffPage() {
  return (
    <RequireAdminPermission permission="staff.manage">
      <StaffPageInner />
    </RequireAdminPermission>
  );
}
