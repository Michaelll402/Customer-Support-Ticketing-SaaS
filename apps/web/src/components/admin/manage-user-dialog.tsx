'use client';

import { useEffect, useState, type ReactNode } from 'react';

import {
  useChangeAdminUserRole,
  useRevokeAdminUserSessions,
  useSetAdminUserStatus,
  useUpdateAdminUserProfile,
  useUpdateAdminUserTeams,
} from '@/hooks/use-admin-users';
import { useTicketTeams } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  userRoleLabels,
  userRoleSchema,
  type AdminUser,
  type UserRole,
} from '@/lib/admin-users';
import { Dialog } from '@/components/ui/dialog';
import { ChevronRightIcon, ShieldIcon, UsersIcon } from '@/components/ui/icons';
import {
  dialogFooter,
  fieldLabel,
  ghostButton,
  inputClass,
  severityButton,
  type Severity,
} from './admin-ui';
import { RoleBadge, StatusBadge } from './admin-badges';

type View =
  | 'menu'
  | 'edit'
  | 'role'
  | 'teams'
  | 'revoke'
  | 'deactivate'
  | 'activate';

const ActionRow = ({
  title,
  description,
  tone,
  disabled,
  disabledReason,
  onClick,
}: {
  title: string;
  description: string;
  tone: Severity;
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
}) => (
  <button
    className={`group flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${
      tone === 'destructive'
        ? 'border-rose-200 hover:bg-rose-50 focus-visible:ring-rose-300'
        : tone === 'caution'
          ? 'border-amber-200 hover:bg-amber-50 focus-visible:ring-amber-300'
          : 'border-slate-200 hover:bg-slate-50 focus-visible:ring-slate-300'
    } ${disabled ? '' : 'cursor-pointer'}`}
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <span className="min-w-0 flex-1">
      <span
        className={`block text-sm font-semibold ${
          tone === 'destructive'
            ? 'text-rose-700'
            : tone === 'caution'
              ? 'text-amber-700'
              : 'text-slate-900'
        }`}
      >
        {title}
      </span>
      <span className="mt-0.5 block text-xs leading-5 text-slate-500">
        {disabled && disabledReason ? disabledReason : description}
      </span>
    </span>
    {disabled ? null : (
      <ChevronRightIcon className="h-4 w-4 flex-none text-slate-300 transition-colors duration-200 group-hover:text-slate-400 motion-reduce:transition-none" />
    )}
  </button>
);

const ErrorAlert = ({ message }: { message: string | null }) =>
  message ? (
    <p
      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
      role="alert"
    >
      {message}
    </p>
  ) : null;

const Notice = ({
  tone,
  children,
}: {
  tone: 'caution' | 'destructive';
  children: ReactNode;
}) => (
  <p
    className={`rounded-lg border px-3 py-2.5 text-xs leading-5 ${
      tone === 'destructive'
        ? 'border-rose-200 bg-rose-50 text-rose-800'
        : 'border-amber-200 bg-amber-50 text-amber-800'
    }`}
  >
    {children}
  </p>
);

const SubFooter = ({
  back,
  pending,
  submitLabel,
  tone = 'normal',
  disabled = false,
  onConfirm,
}: {
  back: () => void;
  pending: boolean;
  submitLabel: string;
  tone?: Severity;
  disabled?: boolean;
  onConfirm?: () => void;
}) => (
  <div className={`${dialogFooter} justify-between`}>
    <button
      className={ghostButton}
      disabled={pending}
      onClick={back}
      type="button"
    >
      Back
    </button>
    <button
      className={severityButton(tone)}
      disabled={pending || disabled}
      onClick={onConfirm}
      type={onConfirm ? 'button' : 'submit'}
    >
      {pending ? 'Working…' : submitLabel}
    </button>
  </div>
);

export const ManageUserDialog = ({
  open,
  user,
  isSelf,
  activeAdminCount,
  onClose,
  onResult,
}: {
  open: boolean;
  user: AdminUser;
  isSelf: boolean;
  activeAdminCount: number;
  onClose: () => void;
  onResult: (message: string) => void;
}) => {
  const [view, setView] = useState<View>('menu');
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);
  const [teamIds, setTeamIds] = useState<string[]>(user.teams.map((t) => t.id));

  const teamsQuery = useTicketTeams(open && view === 'teams');
  const profileMutation = useUpdateAdminUserProfile(user.id);
  const roleMutation = useChangeAdminUserRole(user.id);
  const statusMutation = useSetAdminUserStatus(user.id);
  const teamsMutation = useUpdateAdminUserTeams(user.id);
  const revokeMutation = useRevokeAdminUserSessions(user.id);

  useEffect(() => {
    if (open) {
      setView('menu');
      setError(null);
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setSelectedRole(user.role);
      setTeamIds(user.teams.map((t) => t.id));
    }
  }, [open, user]);

  const isLastAdmin =
    user.role === 'ADMIN' && user.isActive && activeAdminCount <= 1;
  const pending =
    profileMutation.isPending ||
    roleMutation.isPending ||
    statusMutation.isPending ||
    teamsMutation.isPending ||
    revokeMutation.isPending;

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await action();
      onResult(message);
      onClose();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The action could not be completed.'));
    }
  };

  const back = () => {
    setError(null);
    setView('menu');
  };

  let title = 'Manage user';
  let description: ReactNode = (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-slate-600">{user.email}</span>
      <RoleBadge role={user.role} />
      <StatusBadge isActive={user.isActive} />
      {isSelf ? (
        <span className="text-xs font-medium text-slate-400">Your account</span>
      ) : null}
    </span>
  );
  let body: ReactNode = null;

  if (view === 'menu') {
    title = `${user.firstName} ${user.lastName}`;
    body = (
      <div className="grid gap-5">
        <div className="grid gap-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Profile &amp; access
          </h3>
          <ActionRow
            description="Update the display name."
            onClick={() => setView('edit')}
            title="Edit profile"
            tone="normal"
          />
          <ActionRow
            description="Reassign their workspace role. Signs them out everywhere."
            disabled={isLastAdmin}
            disabledReason="Last active admin — promote another admin first."
            onClick={() => setView('role')}
            title="Change role"
            tone="caution"
          />
          <ActionRow
            description="Set which teams this person belongs to."
            onClick={() => setView('teams')}
            title="Edit teams"
            tone="normal"
          />
        </div>

        <div className="grid gap-2.5 border-t border-slate-100 pt-5">
          <div className="flex items-center gap-2">
            <ShieldIcon className="h-4 w-4 text-slate-400" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Security
            </h3>
          </div>
          <ActionRow
            description="Force a re-login on every device."
            onClick={() => setView('revoke')}
            title="Revoke sessions"
            tone="caution"
          />
          {user.isActive ? (
            <ActionRow
              description="Block sign-in and revoke all sessions."
              disabled={isSelf || isLastAdmin}
              disabledReason={
                isSelf
                  ? 'You cannot deactivate your own account.'
                  : 'This is the last active admin.'
              }
              onClick={() => setView('deactivate')}
              title="Deactivate user"
              tone="destructive"
            />
          ) : (
            <ActionRow
              description="Restore this user’s sign-in access."
              onClick={() => setView('activate')}
              title="Activate user"
              tone="normal"
            />
          )}
        </div>

        <div className={`${dialogFooter} justify-end`}>
          <button className={ghostButton} onClick={onClose} type="button">
            Close
          </button>
        </div>
      </div>
    );
  } else if (view === 'edit') {
    title = 'Edit profile';
    description = `Update ${user.firstName} ${user.lastName}’s name.`;
    body = (
      <form
        className="grid gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!firstName.trim() || !lastName.trim()) {
            setError('First and last name are required.');
            return;
          }
          void run(
            () =>
              profileMutation.mutateAsync({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
              }),
            'Profile updated.',
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="mu-first">
              First name
            </label>
            <input
              className={inputClass}
              id="mu-first"
              onChange={(event) => setFirstName(event.target.value)}
              value={firstName}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="mu-last">
              Last name
            </label>
            <input
              className={inputClass}
              id="mu-last"
              onChange={(event) => setLastName(event.target.value)}
              value={lastName}
            />
          </div>
        </div>
        <ErrorAlert message={error} />
        <SubFooter back={back} pending={pending} submitLabel="Save changes" />
      </form>
    );
  } else if (view === 'role') {
    title = 'Change role';
    description = `Currently ${userRoleLabels[user.role]}.`;
    const demotingLastAdmin = isLastAdmin && selectedRole !== 'ADMIN';
    body = (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () => roleMutation.mutateAsync(selectedRole),
            'Role updated.',
          );
        }}
      >
        <div className="grid gap-1.5">
          <label className={fieldLabel} htmlFor="mu-role">
            Role
          </label>
          <select
            className={inputClass}
            id="mu-role"
            onChange={(event) =>
              setSelectedRole(event.target.value as UserRole)
            }
            value={selectedRole}
          >
            {userRoleSchema.options.map((value) => (
              <option key={value} value={value}>
                {userRoleLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <Notice tone="caution">
          Changing the role signs this user out of all active sessions; they
          sign back in with the new permissions.
        </Notice>
        {demotingLastAdmin ? (
          <p
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"
            role="alert"
          >
            This is the last active admin. Promote another admin before changing
            this role.
          </p>
        ) : null}
        <ErrorAlert message={error} />
        <SubFooter
          back={back}
          disabled={selectedRole === user.role || demotingLastAdmin}
          pending={pending}
          submitLabel="Change role"
          tone="caution"
        />
      </form>
    );
  } else if (view === 'teams') {
    title = 'Edit teams';
    description = `Choose the teams ${user.firstName} belongs to.`;
    const teams = teamsQuery.data ?? [];
    body = (
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => teamsMutation.mutateAsync(teamIds), 'Teams updated.');
        }}
      >
        {teamsQuery.isLoading ? (
          <p className="text-sm text-slate-500">Loading teams…</p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-slate-500">No teams available.</p>
        ) : (
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="sr-only">Team memberships</legend>
            {teams.map((team) => (
              <label
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-50 has-[:checked]:border-sky-300 has-[:checked]:bg-sky-50 motion-reduce:transition-none"
                key={team.id}
              >
                <input
                  checked={teamIds.includes(team.id)}
                  className="h-4 w-4 cursor-pointer accent-sky-600"
                  onChange={() =>
                    setTeamIds((current) =>
                      current.includes(team.id)
                        ? current.filter((id) => id !== team.id)
                        : [...current, team.id],
                    )
                  }
                  type="checkbox"
                />
                {team.name}
              </label>
            ))}
          </fieldset>
        )}
        <ErrorAlert message={error} />
        <SubFooter back={back} pending={pending} submitLabel="Save teams" />
      </form>
    );
  } else {
    const config = {
      revoke: {
        title: 'Revoke sessions',
        tone: 'caution' as const,
        message:
          'This signs the user out of every device immediately. They keep their account and can sign back in.',
        confirmLabel: 'Revoke sessions',
        action: () => revokeMutation.mutateAsync(),
        success: 'Sessions revoked.',
      },
      deactivate: {
        title: 'Deactivate user',
        tone: 'destructive' as const,
        message:
          'The user can no longer sign in and all of their sessions are revoked. You can reactivate them later.',
        confirmLabel: 'Deactivate',
        action: () => statusMutation.mutateAsync(false),
        success: 'User deactivated.',
      },
      activate: {
        title: 'Activate user',
        tone: 'normal' as const,
        message: 'Restore this user’s ability to sign in.',
        confirmLabel: 'Activate',
        action: () => statusMutation.mutateAsync(true),
        success: 'User activated.',
      },
    }[view];
    title = config.title;
    description = `${user.firstName} ${user.lastName} · ${user.email}`;
    body = (
      <div className="grid gap-4">
        {config.tone === 'normal' ? (
          <p className="text-sm leading-6 text-slate-600">{config.message}</p>
        ) : (
          <Notice tone={config.tone}>{config.message}</Notice>
        )}
        <ErrorAlert message={error} />
        <SubFooter
          back={back}
          onConfirm={() => void run(config.action, config.success)}
          pending={pending}
          submitLabel={config.confirmLabel}
          tone={config.tone}
        />
      </div>
    );
  }

  return (
    <Dialog
      description={description}
      icon={<UsersIcon className="h-5 w-5" />}
      onClose={pending ? () => undefined : onClose}
      open={open}
      title={title}
    >
      {body}
    </Dialog>
  );
};
