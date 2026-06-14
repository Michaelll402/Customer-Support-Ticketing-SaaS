'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import {
  useCreateAdminUser,
  useUpdateAdminUserProfile,
} from '@/hooks/use-admin-users';
import { useTicketTeams } from '@/hooks/use-tickets';
import { getApiErrorMessage } from '@/lib/api';
import {
  createUserFormSchema,
  userRoleLabels,
  userRoleSchema,
  type AdminUser,
  type CreateUserFormInput,
} from '@/lib/admin-users';
import { Dialog } from '@/components/ui/dialog';
import { UserPlusIcon } from '@/components/ui/icons';
import {
  dialogFooter,
  fieldLabel,
  ghostButton,
  inputClass,
  primaryButton,
} from './admin-ui';

const editProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
});
type EditProfileInput = z.infer<typeof editProfileSchema>;

const errorText = 'text-xs text-rose-600';

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) => (
  <section className="grid gap-3">
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
      ) : null}
    </div>
    {children}
  </section>
);

const Divider = () => <hr className="border-slate-100" />;

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p className={errorText} id={id} role="alert">
      {message}
    </p>
  ) : null;

const FormError = ({ message }: { message: string }) => (
  <p
    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
    role="alert"
  >
    {message}
  </p>
);

const Footer = ({
  onClose,
  pending,
  submitLabel,
}: {
  onClose: () => void;
  pending: boolean;
  submitLabel: string;
}) => (
  <div className={`${dialogFooter} justify-end`}>
    <button
      className={ghostButton}
      disabled={pending}
      onClick={onClose}
      type="button"
    >
      Cancel
    </button>
    <button
      className={`${primaryButton} min-w-[8rem]`}
      disabled={pending}
      type="submit"
    >
      {pending ? 'Saving…' : submitLabel}
    </button>
  </div>
);

const CreateForm = ({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved?: (message: string) => void;
}) => {
  const createMutation = useCreateAdminUser();
  const teamsQuery = useTicketTeams(true);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserFormInput>({
    resolver: zodResolver(createUserFormSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      role: 'AGENT',
      teamIds: [],
    },
  });

  const teamIds = watch('teamIds');
  const role = watch('role');
  const teams = teamsQuery.data ?? [];

  const toggleTeam = (id: string) => {
    setValue(
      'teamIds',
      teamIds.includes(id)
        ? teamIds.filter((value) => value !== id)
        : [...teamIds, id],
      { shouldDirty: true },
    );
  };

  const onSubmit = handleSubmit(async (values) => {
    await createMutation.mutateAsync(values);
    onSaved?.(`${values.firstName} ${values.lastName} was created.`);
    onClose();
  });

  return (
    <form className="grid gap-6" noValidate onSubmit={onSubmit}>
      <Section
        title="Profile"
        description="The person's name and the email they will sign in with."
      >
        <div className="grid gap-1.5">
          <label className={fieldLabel} htmlFor="user-email">
            Email
          </label>
          <input
            aria-describedby="user-email-error"
            aria-invalid={errors.email ? 'true' : undefined}
            autoComplete="off"
            className={inputClass}
            id="user-email"
            type="email"
            {...register('email')}
          />
          <FieldError id="user-email-error" message={errors.email?.message} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="user-first">
              First name
            </label>
            <input
              aria-describedby="user-first-error"
              aria-invalid={errors.firstName ? 'true' : undefined}
              className={inputClass}
              id="user-first"
              {...register('firstName')}
            />
            <FieldError
              id="user-first-error"
              message={errors.firstName?.message}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="user-last">
              Last name
            </label>
            <input
              aria-describedby="user-last-error"
              aria-invalid={errors.lastName ? 'true' : undefined}
              className={inputClass}
              id="user-last"
              {...register('lastName')}
            />
            <FieldError
              id="user-last-error"
              message={errors.lastName?.message}
            />
          </div>
        </div>
      </Section>

      <Divider />

      <Section
        title="Access & credentials"
        description="Choose what the account can do, and set a temporary password they can change after signing in."
      >
        <div className="grid gap-1.5">
          <label className={fieldLabel} htmlFor="user-role">
            Role
          </label>
          <select className={inputClass} id="user-role" {...register('role')}>
            {userRoleSchema.options.map((value) => (
              <option key={value} value={value}>
                {userRoleLabels[value]}
              </option>
            ))}
          </select>
          <p className="text-xs leading-5 text-slate-500">
            {role === 'CUSTOMER'
              ? 'Customers can only open and view their own tickets.'
              : role === 'ADMIN'
                ? 'Admins can manage users, the audit log, and every ticket.'
                : 'Managers and agents are scoped to the teams selected below.'}
          </p>
        </div>
        <div className="grid gap-1.5">
          <label className={fieldLabel} htmlFor="user-password">
            Temporary password
          </label>
          <div className="flex gap-2">
            <input
              aria-describedby="user-password-error"
              aria-invalid={errors.password ? 'true' : undefined}
              autoComplete="new-password"
              className={inputClass}
              id="user-password"
              type={showPassword ? 'text' : 'password'}
              {...register('password')}
            />
            <button
              aria-pressed={showPassword}
              className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 motion-reduce:transition-none"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <FieldError
            id="user-password-error"
            message={errors.password?.message}
          />
        </div>
      </Section>

      {role !== 'CUSTOMER' ? (
        <>
          <Divider />
          <Section
            title="Team memberships"
            description="Tickets are routed to teams. Select where this person works."
          >
            {teamsQuery.isLoading ? (
              <p className="text-xs text-slate-500">Loading teams…</p>
            ) : teams.length === 0 ? (
              <p className="text-xs text-slate-500">No teams available yet.</p>
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
                      onChange={() => toggleTeam(team.id)}
                      type="checkbox"
                    />
                    {team.name}
                  </label>
                ))}
              </fieldset>
            )}
          </Section>
        </>
      ) : null}

      {createMutation.isError ? (
        <FormError
          message={getApiErrorMessage(
            createMutation.error,
            'The user could not be created.',
          )}
        />
      ) : null}

      <Footer
        onClose={onClose}
        pending={isSubmitting}
        submitLabel="Create user"
      />
    </form>
  );
};

const EditProfileForm = ({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) => {
  const updateMutation = useUpdateAdminUserProfile(user.id);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditProfileInput>({
    resolver: zodResolver(editProfileSchema),
    mode: 'onBlur',
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
  });

  const onSubmit = handleSubmit(async (values) => {
    await updateMutation.mutateAsync(values);
    onSaved?.('Profile updated.');
    onClose();
  });

  return (
    <form className="grid gap-6" noValidate onSubmit={onSubmit}>
      <Section title="Profile">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="edit-first">
              First name
            </label>
            <input
              aria-describedby="edit-first-error"
              aria-invalid={errors.firstName ? 'true' : undefined}
              className={inputClass}
              id="edit-first"
              {...register('firstName')}
            />
            <FieldError
              id="edit-first-error"
              message={errors.firstName?.message}
            />
          </div>
          <div className="grid gap-1.5">
            <label className={fieldLabel} htmlFor="edit-last">
              Last name
            </label>
            <input
              aria-describedby="edit-last-error"
              aria-invalid={errors.lastName ? 'true' : undefined}
              className={inputClass}
              id="edit-last"
              {...register('lastName')}
            />
            <FieldError
              id="edit-last-error"
              message={errors.lastName?.message}
            />
          </div>
        </div>
      </Section>

      {updateMutation.isError ? (
        <FormError
          message={getApiErrorMessage(
            updateMutation.error,
            'The profile could not be saved.',
          )}
        />
      ) : null}

      <Footer
        onClose={onClose}
        pending={isSubmitting}
        submitLabel="Save changes"
      />
    </form>
  );
};

export const UserFormDialog = ({
  open,
  mode,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  user?: AdminUser;
  onClose: () => void;
  onSaved?: (message: string) => void;
}) => {
  // Remount the form each time the dialog opens so values reset cleanly.
  const [instance, setInstance] = useState(0);
  useEffect(() => {
    if (open) setInstance((value) => value + 1);
  }, [open]);

  return (
    <Dialog
      icon={<UserPlusIcon className="h-5 w-5" />}
      onClose={onClose}
      open={open}
      size="lg"
      title={mode === 'create' ? 'Create user' : 'Edit profile'}
      description={
        mode === 'create'
          ? 'Set up a new staff or customer account.'
          : `Update ${user?.firstName ?? ''} ${user?.lastName ?? ''}’s name.`
      }
    >
      {mode === 'create' ? (
        <CreateForm key={instance} onClose={onClose} onSaved={onSaved} />
      ) : user ? (
        <EditProfileForm
          key={instance}
          onClose={onClose}
          onSaved={onSaved}
          user={user}
        />
      ) : null}
    </Dialog>
  );
};
