'use client';

import type { UserRole } from '@/lib/auth';
import type { TicketDetailResponse } from '@/lib/tickets';

import { AssigneeSelector } from './assignee-selector';
import { CategoryControl } from './category-control';
import { PriorityControl } from './priority-control';
import { StatusControl } from './status-control';
import { TagSelector } from './tag-selector';
import { TeamTransferControl } from './team-transfer-control';

const staffRoles: ReadonlyArray<UserRole> = ['AGENT', 'MANAGER', 'ADMIN'];
const teamTransferRoles: ReadonlyArray<UserRole> = ['MANAGER', 'ADMIN'];

export const TicketWorkflowPanel = ({
  currentUserRole,
  ticket,
}: {
  currentUserRole: UserRole | null;
  ticket: TicketDetailResponse;
}) => {
  if (!currentUserRole || !staffRoles.includes(currentUserRole)) {
    return null;
  }

  const canTransferTeam = teamTransferRoles.includes(currentUserRole);

  return (
    <section
      className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur"
      key={`${ticket.id}:workflow`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        Workflow controls
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        Update ticket state
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Changes apply through the workflow REST endpoints. Each change emits a
        timeline event on the backend and the ticket detail refreshes after
        save.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatusControl ticket={ticket} />
        <PriorityControl ticket={ticket} />
        <AssigneeSelector ticket={ticket} />
        <CategoryControl ticket={ticket} />
        <TagSelector ticket={ticket} />
        {canTransferTeam ? <TeamTransferControl ticket={ticket} /> : null}
      </div>
    </section>
  );
};
