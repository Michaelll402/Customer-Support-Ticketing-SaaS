'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { useCurrentUser } from '@/hooks/use-auth';
import { useAdminUsers, useAdminUserStats } from '@/hooks/use-admin-users';
import { getApiErrorMessage } from '@/lib/api';
import {
  userRoleLabels,
  userRoleSchema,
  type AdminUser,
  type AdminUserListQuery,
  type UserRole,
} from '@/lib/admin-users';
import {
  ChevronRightIcon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon,
} from '@/components/ui/icons';
import {
  ConsoleHeader,
  EmptyState,
  ErrorState,
  Metric,
  MetricStrip,
  Pagination,
  consoleSurface,
  ghostButton,
  inputClass,
  primaryButton,
} from './admin-ui';
import { RoleBadge, StatusBadge, UserAvatar } from './admin-badges';
import { ManageUserDialog } from './manage-user-dialog';
import { UserFormDialog } from './user-form-dialog';

const PAGE_SIZE = 20;

const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(
    new Date(value),
  );

const TeamChips = ({ teams }: { teams: AdminUser['teams'] }) => {
  if (teams.length === 0) {
    return <span className="text-sm text-slate-500">No teams</span>;
  }
  const shown = teams.slice(0, 2);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((team) => (
        <span
          className="inline-flex max-w-[10rem] truncate rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
          key={team.id}
          title={team.name}
        >
          {team.name}
        </span>
      ))}
      {teams.length > shown.length ? (
        <span className="text-xs font-medium text-slate-500">
          +{teams.length - shown.length}
        </span>
      ) : null}
    </div>
  );
};

const ManageButton = ({
  user,
  onClick,
  full = false,
}: {
  user: AdminUser;
  onClick: () => void;
  full?: boolean;
}) => (
  <button
    aria-label={`Manage ${user.firstName} ${user.lastName}`}
    className={`${ghostButton} px-3.5 py-2 ${full ? 'w-full' : ''}`}
    onClick={onClick}
    type="button"
  >
    Manage
    <ChevronRightIcon className="h-4 w-4 text-slate-400" />
  </button>
);

const TableSkeleton = () => (
  <div aria-hidden="true" className="divide-y divide-slate-100">
    {Array.from({ length: 6 }).map((_, index) => (
      <div className="flex items-center gap-3 px-5 py-4" key={index}>
        <div className="h-9 w-9 flex-none animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
        <div className="grid flex-1 gap-2">
          <div className="h-3 w-40 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
          <div className="h-3 w-56 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
        </div>
        <div className="hidden h-6 w-20 animate-pulse rounded-full bg-slate-100 sm:block motion-reduce:animate-none" />
        <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none" />
      </div>
    ))}
  </div>
);

const headCell = 'px-5 py-3 font-semibold';

export const AdminUsersPage = () => {
  const currentUserQuery = useCurrentUser();
  const role = currentUserQuery.data?.role ?? null;
  const isAdmin = role === 'ADMIN';
  const selfId = currentUserQuery.data?.id ?? null;

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | UserRole>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>(
    '',
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [manageUser, setManageUser] = useState<AdminUser | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Debounce the search box so we do not query on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const query: AdminUserListQuery = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: search || undefined,
      role: roleFilter || undefined,
      isActive:
        statusFilter === 'active'
          ? true
          : statusFilter === 'inactive'
            ? false
            : undefined,
    }),
    [page, search, roleFilter, statusFilter],
  );

  const usersQuery = useAdminUsers(query, isAdmin);
  const statsQuery = useAdminUserStats(isAdmin);
  const data = usersQuery.data;
  const stats = statsQuery.data;
  const hasFilters = Boolean(search || roleFilter || statusFilter);

  if (currentUserQuery.isLoading) {
    return (
      <div
        className={`${consoleSurface} animate-pulse p-6 motion-reduce:animate-none`}
      >
        <div className="h-6 w-48 rounded bg-slate-100" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <section className={`${consoleSurface} px-6 py-6`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">
          Access denied
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          User management is admin-only
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Only administrators can manage workspace users.
        </p>
        <Link className={`mt-5 ${primaryButton}`} href="/tickets">
          Back to tickets
        </Link>
      </section>
    );
  }

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setRoleFilter('');
    setStatusFilter('');
    setPage(1);
  };

  let body: ReactNode;
  if (usersQuery.isLoading) {
    body = <TableSkeleton />;
  } else if (usersQuery.isError) {
    body = (
      <ErrorState
        message={getApiErrorMessage(
          usersQuery.error,
          'Users could not be loaded.',
        )}
        onRetry={() => void usersQuery.refetch()}
      />
    );
  } else if (!data || data.items.length === 0) {
    body = (
      <EmptyState
        action={
          hasFilters ? (
            <button
              className={ghostButton}
              onClick={resetFilters}
              type="button"
            >
              Clear filters
            </button>
          ) : (
            <button
              className={primaryButton}
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <UserPlusIcon className="h-4 w-4" />
              Create user
            </button>
          )
        }
        description={
          hasFilters
            ? 'Try a different search, role, or status — or clear the filters to see everyone.'
            : 'Create the first account to start managing access.'
        }
        icon={<UsersIcon className="h-6 w-6" />}
        title={hasFilters ? 'No users match these filters' : 'No users yet'}
      />
    );
  } else {
    body = (
      <>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                <th className={headCell} scope="col">
                  User
                </th>
                <th className={headCell} scope="col">
                  Role
                </th>
                <th className={headCell} scope="col">
                  Status
                </th>
                <th className={headCell} scope="col">
                  Teams
                </th>
                <th className={headCell} scope="col">
                  Updated
                </th>
                <th className={`${headCell} text-right`} scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((user) => (
                <tr
                  className="transition-colors duration-150 hover:bg-slate-50/70 motion-reduce:transition-none"
                  key={user.id}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        firstName={user.firstName}
                        lastName={user.lastName}
                        role={user.role}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {user.firstName} {user.lastName}
                          {user.id === selfId ? (
                            <span className="ml-2 text-xs font-normal text-slate-500">
                              You
                            </span>
                          ) : null}
                        </p>
                        <p
                          className="truncate text-xs text-slate-500"
                          title={user.email}
                        >
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge isActive={user.isActive} />
                  </td>
                  <td className="px-5 py-3.5">
                    <TeamChips teams={user.teams} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">
                    {shortDate(user.updatedAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <ManageButton
                      onClick={() => setManageUser(user)}
                      user={user}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 p-4 lg:hidden">
          {data.items.map((user) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={user.id}
            >
              <div className="flex items-start gap-3">
                <UserAvatar
                  firstName={user.firstName}
                  lastName={user.lastName}
                  role={user.role}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {user.firstName} {user.lastName}
                    {user.id === selfId ? (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        You
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user.email}
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                    Role
                  </dt>
                  <dd className="mt-1">
                    <RoleBadge role={user.role} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                    Status
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge isActive={user.isActive} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                    Teams
                  </dt>
                  <dd className="mt-1">
                    <TeamChips teams={user.teams} />
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">
                    Updated
                  </dt>
                  <dd className="mt-1 text-slate-600">
                    {shortDate(user.updatedAt)}
                  </dd>
                </div>
              </dl>
              <div className="mt-4">
                <ManageButton
                  full
                  onClick={() => setManageUser(user)}
                  user={user}
                />
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1200px] gap-4">
      <ConsoleHeader
        actions={
          <>
            <span className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 sm:inline-flex">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
              {stats ? `${stats.active} active` : '—'} ·{' '}
              {stats ? `${stats.total} total` : '—'}
            </span>
            <button
              className={primaryButton}
              onClick={() => setCreateOpen(true)}
              type="button"
            >
              <UserPlusIcon className="h-4 w-4" />
              Create user
            </button>
          </>
        }
        description="Create accounts, assign roles and teams, and control workspace access. Role changes, deactivation, and session revocation sign the user out everywhere."
        eyebrow="Administration"
        icon={<UsersIcon className="h-5 w-5" />}
        title="User management"
      />

      {success ? (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{success}</span>
          <button
            aria-label="Dismiss notification"
            className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md text-emerald-700 transition-colors duration-200 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 motion-reduce:transition-none"
            onClick={() => setSuccess(null)}
            type="button"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <MetricStrip>
        <Metric
          label="Total"
          loading={statsQuery.isLoading}
          value={stats?.total ?? 0}
        />
        <Metric
          label="Active"
          loading={statsQuery.isLoading}
          tone="active"
          value={stats?.active ?? 0}
        />
        <Metric
          label="Inactive"
          loading={statsQuery.isLoading}
          tone="inactive"
          value={stats?.inactive ?? 0}
        />
        <Metric
          label="Agents"
          loading={statsQuery.isLoading}
          tone="agent"
          value={stats?.agents ?? 0}
        />
        <Metric
          label="Managers"
          loading={statsQuery.isLoading}
          tone="manager"
          value={stats?.managers ?? 0}
        />
        <Metric
          label="Admins"
          loading={statsQuery.isLoading}
          tone="admin"
          value={stats?.admins ?? 0}
        />
      </MetricStrip>

      <section className={`${consoleSurface} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative grow">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon className="h-4 w-4" />
              </span>
              <label className="sr-only" htmlFor="user-search">
                Search users
              </label>
              <input
                className={`${inputClass} pl-9`}
                id="user-search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or email"
                type="search"
                value={searchInput}
              />
            </div>
            <label className="sr-only" htmlFor="user-role-filter">
              Filter by role
            </label>
            <select
              className={`${inputClass} sm:w-40`}
              id="user-role-filter"
              onChange={(event) => {
                setRoleFilter(event.target.value as '' | UserRole);
                setPage(1);
              }}
              value={roleFilter}
            >
              <option value="">All roles</option>
              {userRoleSchema.options.map((value) => (
                <option key={value} value={value}>
                  {userRoleLabels[value]}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="user-status-filter">
              Filter by status
            </label>
            <select
              className={`${inputClass} sm:w-40`}
              id="user-status-filter"
              onChange={(event) => {
                setStatusFilter(
                  event.target.value as '' | 'active' | 'inactive',
                );
                setPage(1);
              }}
              value={statusFilter}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button
              className={`${ghostButton} w-full justify-center sm:w-auto`}
              disabled={!hasFilters}
              onClick={resetFilters}
              type="button"
            >
              Clear
            </button>
          </div>
          {data ? (
            <p className="text-xs text-slate-500">
              <span className="font-medium tabular-nums text-slate-700">
                {data.meta.totalItems}
              </span>{' '}
              {data.meta.totalItems === 1 ? 'user' : 'users'}
              {hasFilters ? ' match your filters' : ''}
            </p>
          ) : null}
        </div>

        <div aria-busy={usersQuery.isFetching}>{body}</div>

        {data && data.items.length > 0 ? (
          <Pagination
            hasNext={data.meta.hasNextPage}
            hasPrev={data.meta.hasPreviousPage}
            onNext={() => setPage((value) => value + 1)}
            onPrev={() => setPage((value) => Math.max(1, value - 1))}
            page={data.meta.page}
            totalItems={data.meta.totalItems}
            totalPages={data.meta.totalPages}
            unit="users"
          />
        ) : null}
      </section>

      <UserFormDialog
        mode="create"
        onClose={() => setCreateOpen(false)}
        onSaved={(message) => setSuccess(message)}
        open={createOpen}
      />

      {manageUser ? (
        <ManageUserDialog
          activeAdminCount={data?.activeAdminCount ?? 0}
          isSelf={manageUser.id === selfId}
          onClose={() => setManageUser(null)}
          onResult={(message) => setSuccess(message)}
          open={Boolean(manageUser)}
          user={manageUser}
        />
      ) : null}
    </div>
  );
};
