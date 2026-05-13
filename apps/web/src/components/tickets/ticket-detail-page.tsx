'use client';

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';

import { useCurrentUser } from '@/hooks/use-auth';
import { useTicketRealtimeSubscription } from '@/hooks/use-realtime';
import {
  useCreateTicketInternalNote,
  useCreateTicketPublicReply,
  useTicket,
  useTicketAttachmentDownloadUrl,
  useTicketTimeline,
  useUploadTicketAttachment,
} from '@/hooks/use-tickets';
import { ApiClientError, getApiErrorMessage } from '@/lib/api';
import type { UserRole } from '@/lib/auth';
import {
  createTicketMessageFormSchema,
  ticketAttachmentAllowedMimeTypes,
  ticketAttachmentMaxBytes,
  ticketPriorityLabels,
  ticketStatusLabels,
  ticketTimelineEventTypeLabels,
  type CreateTicketMessageInput,
  type TicketDetailResponse,
  type TicketPriority,
  type TicketStatus,
  type TicketTimelineAttachment,
  type TicketTimelineItem,
  type TicketTimelineMessageItem,
  type TicketTimelineSystemEventItem,
} from '@/lib/tickets';

import { TicketWorkflowPanel } from './ticket-workflow-panel';

const statusToneClasses: Record<TicketStatus, string> = {
  CLOSED: 'bg-slate-200 text-slate-700',
  OPEN: 'bg-emerald-100 text-emerald-800',
  PENDING: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-sky-100 text-sky-800',
};

const priorityToneClasses: Record<TicketPriority, string> = {
  HIGH: 'bg-orange-100 text-orange-800',
  LOW: 'bg-slate-200 text-slate-700',
  MEDIUM: 'bg-indigo-100 text-indigo-800',
  URGENT: 'bg-rose-100 text-rose-800',
};

const staffRoles = new Set<UserRole>(['ADMIN', 'AGENT', 'MANAGER']);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const formatPersonName = (person: {
  email: string;
  firstName: string;
  lastName: string;
}) => `${person.firstName} ${person.lastName}`;

const formatFileSize = (sizeBytes: number) => {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

const allowedAttachmentTypeSummary = 'PDF, PNG, JPG, GIF, WebP, CSV, or TXT';

const isAllowedAttachmentMimeType = (mimeType: string) =>
  ticketAttachmentAllowedMimeTypes.some(
    (allowedType) => allowedType === mimeType,
  );

const validateAttachmentFile = (file: File) => {
  if (file.size <= 0) {
    return 'Attachment file cannot be empty.';
  }

  if (file.size > ticketAttachmentMaxBytes) {
    return `Attachment must be ${formatFileSize(ticketAttachmentMaxBytes)} or smaller.`;
  }

  if (!isAllowedAttachmentMimeType(file.type)) {
    return `Unsupported file type. Upload ${allowedAttachmentTypeSummary}.`;
  }

  return null;
};

const ToneBadge = ({
  children,
  toneClasses,
}: {
  children: ReactNode;
  toneClasses: string;
}) => (
  <span
    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${toneClasses}`}
  >
    {children}
  </span>
);

const MetadataCard = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {label}
    </p>
    <div className="mt-3 text-sm leading-6 text-slate-700">{value}</div>
  </div>
);

const LoadingState = () => (
  <div className="grid gap-6">
    <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-10 w-3/4 animate-pulse rounded-2xl bg-slate-200" />
      <div className="mt-5 flex gap-3">
        <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-slate-200" />
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.28)]"
          key={index}
        >
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
        </div>
      ))}
    </section>
  </div>
);

const StatePanel = ({
  action,
  description,
  eyebrow,
  title,
  tone,
}: {
  action?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  tone: 'amber' | 'rose' | 'slate';
}) => {
  const toneClasses = {
    amber: {
      container: 'border-amber-200 bg-amber-50',
      eyebrow: 'text-amber-700',
      text: 'text-amber-900',
    },
    rose: {
      container: 'border-rose-200 bg-rose-50',
      eyebrow: 'text-rose-700',
      text: 'text-rose-900',
    },
    slate: {
      container: 'border-slate-200 bg-white',
      eyebrow: 'text-slate-500',
      text: 'text-slate-700',
    },
  }[tone];

  return (
    <section
      className={`rounded-[2rem] border px-6 py-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] ${toneClasses.container}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-[0.28em] ${toneClasses.eyebrow}`}
      >
        {eyebrow}
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h1>
      <p className={`mt-3 max-w-2xl text-sm leading-6 ${toneClasses.text}`}>
        {description}
      </p>
      {action ? (
        <div className="mt-6 flex flex-wrap gap-3">{action}</div>
      ) : null}
    </section>
  );
};

const TicketDescription = ({ ticket }: { ticket: TicketDetailResponse }) => (
  <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
      Description
    </p>
    <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5">
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {ticket.description}
      </p>
    </div>
  </section>
);

const TicketMetadata = ({ ticket }: { ticket: TicketDetailResponse }) => (
  <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
      Ticket metadata
    </p>
    <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
      Core record fields
    </h2>
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <MetadataCard
        label="Requester"
        value={
          <>
            <p className="font-semibold text-slate-950">
              {formatPersonName(ticket.requester)}
            </p>
            <p className="text-slate-600">{ticket.requester.email}</p>
          </>
        }
      />

      {ticket.assignee ? (
        <MetadataCard
          label="Assignee"
          value={
            <>
              <p className="font-semibold text-slate-950">
                {formatPersonName(ticket.assignee)}
              </p>
              <p className="text-slate-600">{ticket.assignee.email}</p>
            </>
          }
        />
      ) : null}

      {ticket.team ? (
        <MetadataCard
          label="Team"
          value={
            <>
              <p className="font-semibold text-slate-950">{ticket.team.name}</p>
              {ticket.team.description ? (
                <p className="text-slate-600">{ticket.team.description}</p>
              ) : null}
            </>
          }
        />
      ) : null}

      {ticket.category ? (
        <MetadataCard
          label="Category"
          value={
            <>
              <p className="font-semibold text-slate-950">
                {ticket.category.name}
              </p>
              {ticket.category.description ? (
                <p className="text-slate-600">{ticket.category.description}</p>
              ) : null}
            </>
          }
        />
      ) : null}

      {ticket.tags.length > 0 ? (
        <MetadataCard
          label="Tags"
          value={
            <div className="flex flex-wrap gap-2">
              {ticket.tags.map((tag) => (
                <span
                  className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700"
                  key={tag.id}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          }
        />
      ) : null}

      <MetadataCard
        label="Created"
        value={
          <p className="font-semibold text-slate-950">
            {formatDateTime(ticket.createdAt)}
          </p>
        }
      />

      <MetadataCard
        label="Updated"
        value={
          <p className="font-semibold text-slate-950">
            {formatDateTime(ticket.updatedAt)}
          </p>
        }
      />

      {ticket.firstResponseDueAt ? (
        <MetadataCard
          label="First response due"
          value={
            <p className="font-semibold text-slate-950">
              {formatDateTime(ticket.firstResponseDueAt)}
            </p>
          }
        />
      ) : null}

      {ticket.resolutionDueAt ? (
        <MetadataCard
          label="Resolution due"
          value={
            <p className="font-semibold text-slate-950">
              {formatDateTime(ticket.resolutionDueAt)}
            </p>
          }
        />
      ) : null}
    </div>
  </section>
);

const TimelineLoadingState = () => (
  <div className="mt-6 grid gap-4">
    {Array.from({ length: 3 }).map((_, index) => (
      <div
        className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-5"
        key={index}
      >
        <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-4 w-5/6 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-2/3 animate-pulse rounded-full bg-slate-200" />
      </div>
    ))}
  </div>
);

const TimelineInlineState = ({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) => (
  <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-5">
    <h3 className="text-base font-semibold tracking-tight text-slate-950">
      {title}
    </h3>
    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

const DraftAttachmentList = ({
  attachments,
  disabled,
  onRemove,
}: {
  attachments: TicketTimelineAttachment[];
  disabled: boolean;
  onRemove: (attachmentId: string) => void;
}) => {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <div
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          key={attachment.id}
          title={`${attachment.mimeType} - ${formatFileSize(
            attachment.sizeBytes,
          )}`}
        >
          <span aria-hidden="true">File</span>
          <span>{attachment.filename}</span>
          <span className="font-medium text-slate-500">
            {formatFileSize(attachment.sizeBytes)}
          </span>
          <button
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={() => {
              onRemove(attachment.id);
            }}
            type="button"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

const TimelineAttachmentList = ({
  attachments,
}: {
  attachments: TicketTimelineAttachment[];
}) => {
  const ticketId = attachments[0]?.ticketId ?? '';
  const downloadUrlMutation = useTicketAttachmentDownloadUrl(ticketId);
  const [activeDownloadId, setActiveDownloadId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (attachments.length === 0) {
    return null;
  }

  const handleDownload = async (attachment: TicketTimelineAttachment) => {
    setDownloadError(null);
    setActiveDownloadId(attachment.id);

    try {
      const signedUrl = await downloadUrlMutation.mutateAsync(attachment.id);
      const openedWindow = window.open(
        signedUrl.url,
        '_blank',
        'noopener,noreferrer',
      );

      if (openedWindow) {
        openedWindow.opener = null;
      } else {
        setDownloadError('The signed download URL was blocked by the browser.');
      }
    } catch (error) {
      setDownloadError(
        getApiErrorMessage(error, 'The attachment download could not start.'),
      );
    } finally {
      setActiveDownloadId(null);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <div
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            key={attachment.id}
            title={`${attachment.mimeType} - ${formatFileSize(
              attachment.sizeBytes,
            )}`}
          >
            <span aria-hidden="true">File</span>
            <span>{attachment.filename}</span>
            <span className="font-medium text-slate-500">
              {formatFileSize(attachment.sizeBytes)}
            </span>
            <button
              className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={downloadUrlMutation.isPending}
              onClick={() => {
                void handleDownload(attachment);
              }}
              type="button"
            >
              {downloadUrlMutation.isPending &&
              activeDownloadId === attachment.id
                ? 'Opening...'
                : 'Download'}
            </button>
          </div>
        ))}
      </div>
      {downloadError ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {downloadError}
        </p>
      ) : null}
    </div>
  );
};

const MessageTimelineItem = ({ item }: { item: TicketTimelineMessageItem }) => {
  const isInternal = item.type === 'INTERNAL_NOTE';

  return (
    <article
      className={`relative rounded-[1.5rem] border px-5 py-5 ${
        isInternal ? 'border-amber-200 bg-amber-50' : 'border-sky-100 bg-white'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {isInternal ? 'Internal note' : 'Public reply'}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-950">
            {formatPersonName(item.author)}
          </h3>
          <p className="mt-1 text-xs text-slate-500">{item.author.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isInternal ? (
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">
              Staff only
            </span>
          ) : null}
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {formatDateTime(item.createdAt)}
          </span>
        </div>
      </div>

      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
        {item.body}
      </p>
      <TimelineAttachmentList attachments={item.attachments} />
    </article>
  );
};

const SystemEventTimelineItem = ({
  item,
}: {
  item: TicketTimelineSystemEventItem;
}) => (
  <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
          System event
        </p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">
          {ticketTimelineEventTypeLabels[item.eventType]}
        </h3>
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {formatDateTime(item.createdAt)}
      </span>
    </div>
    {item.actor ? (
      <p className="mt-3 text-sm text-slate-600">
        Actor: {formatPersonName(item.actor)} ({item.actor.email})
      </p>
    ) : (
      <p className="mt-3 text-sm text-slate-600">System-generated update.</p>
    )}
  </article>
);

const TimelineItem = ({ item }: { item: TicketTimelineItem }) => {
  if (item.type === 'SYSTEM_EVENT') {
    return <SystemEventTimelineItem item={item} />;
  }

  return <MessageTimelineItem item={item} />;
};

type ComposerKind = 'internal-note' | 'public-reply';

const MessageComposer = ({
  description,
  disabledReason,
  kind,
  onSubmit,
  submitLabel,
  ticketId,
  title,
}: {
  description: string;
  disabledReason?: string;
  kind: ComposerKind;
  onSubmit: (input: CreateTicketMessageInput) => Promise<void>;
  submitLabel: string;
  ticketId: string;
  title: string;
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadAttachmentMutation = useUploadTicketAttachment(ticketId);
  const resetUploadAttachmentMutation = uploadAttachmentMutation.reset;
  const [body, setBody] = useState('');
  const [uploadedAttachments, setUploadedAttachments] = useState<
    TicketTimelineAttachment[]
  >([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isInternal = kind === 'internal-note';
  const isUploadingAttachment = uploadAttachmentMutation.isPending;
  const isDisabled =
    Boolean(disabledReason) || isSubmitting || isUploadingAttachment;

  useEffect(() => {
    setBody('');
    setUploadedAttachments([]);
    setAttachmentError(null);
    setValidationError(null);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    resetUploadAttachmentMutation();

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [kind, resetUploadAttachmentMutation, ticketId]);

  const handleAttachmentChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.currentTarget.files?.[0];

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (!file) {
      return;
    }

    setAttachmentError(null);
    setSubmitError(null);
    setSuccessMessage(null);

    const fileValidationError = validateAttachmentFile(file);

    if (fileValidationError) {
      setAttachmentError(fileValidationError);
      return;
    }

    try {
      const uploadedAttachment =
        await uploadAttachmentMutation.mutateAsync(file);
      setUploadedAttachments((currentAttachments) => [
        ...currentAttachments,
        uploadedAttachment,
      ]);
    } catch (error) {
      setAttachmentError(
        getApiErrorMessage(error, 'The attachment could not be uploaded.'),
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSuccessMessage(null);

    const parsed = createTicketMessageFormSchema.safeParse({ body });

    if (!parsed.success) {
      setValidationError(
        parsed.error.issues[0]?.message ?? 'Enter a valid message.',
      );
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      await onSubmit({
        body: parsed.data.body,
        attachmentIds: uploadedAttachments.map((attachment) => attachment.id),
      });
      setBody('');
      setUploadedAttachments([]);
      setAttachmentError(null);
      setSuccessMessage(
        isInternal ? 'Internal note added.' : 'Public reply added.',
      );
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          isInternal
            ? 'The internal note could not be added.'
            : 'The public reply could not be added.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      className={`rounded-[1.5rem] border px-5 py-5 ${
        isInternal ? 'border-amber-200 bg-amber-50' : 'border-sky-100 bg-white'
      }`}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {isInternal ? 'Staff only' : 'Customer visible'}
          </p>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-slate-950">
            {title}
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>
        {isInternal ? (
          <span className="inline-flex rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-900">
            Internal
          </span>
        ) : null}
      </div>

      <label className="mt-4 block">
        <span className="sr-only">{title}</span>
        <textarea
          className="min-h-32 w-full resize-y rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          disabled={isDisabled}
          maxLength={5_000}
          onChange={(event) => {
            setBody(event.target.value);
            if (validationError) {
              setValidationError(null);
            }
          }}
          placeholder={
            isInternal
              ? 'Add private context for the support team.'
              : 'Write a customer-visible reply.'
          }
          value={body}
        />
      </label>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-medium text-slate-500">
          {body.length}/5,000 characters. Attach {allowedAttachmentTypeSummary}
          files up to {formatFileSize(ticketAttachmentMaxBytes)} each.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled}
            onClick={() => {
              fileInputRef.current?.click();
            }}
            type="button"
          >
            {isUploadingAttachment ? 'Uploading...' : 'Attach file'}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isDisabled}
            type="submit"
          >
            {isSubmitting ? 'Submitting...' : submitLabel}
          </button>
        </div>
      </div>

      <input
        accept={ticketAttachmentAllowedMimeTypes.join(',')}
        className="hidden"
        disabled={isDisabled}
        onChange={(event) => {
          void handleAttachmentChange(event);
        }}
        ref={fileInputRef}
        type="file"
      />

      <DraftAttachmentList
        attachments={uploadedAttachments}
        disabled={isDisabled}
        onRemove={(attachmentId) => {
          setUploadedAttachments((currentAttachments) =>
            currentAttachments.filter(
              (attachment) => attachment.id !== attachmentId,
            ),
          );
        }}
      />

      {disabledReason ? (
        <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {disabledReason}
        </p>
      ) : null}

      {attachmentError ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {attachmentError}
        </p>
      ) : null}

      {validationError ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {validationError}
        </p>
      ) : null}

      {submitError ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {submitError}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </p>
      ) : null}
    </form>
  );
};

const TicketComposers = ({
  currentUserRole,
  ticket,
}: {
  currentUserRole: UserRole | null;
  ticket: TicketDetailResponse;
}) => {
  const publicReplyMutation = useCreateTicketPublicReply(ticket.id);
  const internalNoteMutation = useCreateTicketInternalNote(ticket.id);
  const isStaff = currentUserRole ? staffRoles.has(currentUserRole) : false;
  const isClosed = ticket.status === 'CLOSED';
  const publicReplyDisabledReason = isClosed
    ? 'Public replies are disabled on closed tickets.'
    : undefined;

  if (!currentUserRole) {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        Message composers
      </p>
      <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
        Add to the conversation
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        Add customer-visible replies or staff-only notes with attachments.
        Workflow actions remain deferred.
      </p>

      <div className="mt-6 grid gap-4">
        <MessageComposer
          description="Visible to the customer and support staff. No automatic status changes are made."
          disabledReason={publicReplyDisabledReason}
          kind="public-reply"
          key={`${ticket.id}:public-reply`}
          onSubmit={async (input) => {
            await publicReplyMutation.mutateAsync(input);
          }}
          submitLabel="Post public reply"
          ticketId={ticket.id}
          title="Public reply"
        />

        {isStaff ? (
          <MessageComposer
            description="Visible only to staff. Customers must never receive internal note content."
            kind="internal-note"
            key={`${ticket.id}:internal-note`}
            onSubmit={async (input) => {
              await internalNoteMutation.mutateAsync(input);
            }}
            submitLabel="Add internal note"
            ticketId={ticket.id}
            title="Internal note"
          />
        ) : null}
      </div>
    </section>
  );
};

const TicketTimeline = ({ ticketId }: { ticketId: string }) => {
  const timelineQuery = useTicketTimeline(ticketId);

  const statusCode =
    timelineQuery.error instanceof ApiClientError
      ? timelineQuery.error.statusCode
      : null;

  let content: ReactNode;

  if (timelineQuery.isLoading) {
    content = <TimelineLoadingState />;
  } else if (timelineQuery.isError) {
    if (statusCode === 403) {
      content = (
        <TimelineInlineState
          description="The signed-in user can no longer access this ticket timeline. Ticket visibility is enforced by the backend."
          title="Timeline access denied"
        />
      );
    } else if (statusCode === 404) {
      content = (
        <TimelineInlineState
          description="The ticket timeline could not be found for this record."
          title="Timeline not found"
        />
      );
    } else {
      content = (
        <TimelineInlineState
          action={
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                void timelineQuery.refetch();
              }}
              type="button"
            >
              Retry timeline
            </button>
          }
          description={getApiErrorMessage(
            timelineQuery.error,
            'The ticket timeline could not be loaded.',
          )}
          title="Timeline unavailable"
        />
      );
    }
  } else if (!timelineQuery.data || timelineQuery.data.items.length === 0) {
    content = (
      <TimelineInlineState
        description="No replies, internal notes, or timeline events have been returned for this ticket yet."
        title="No timeline entries yet"
      />
    );
  } else {
    content = (
      <div className="mt-6 grid gap-4">
        {timelineQuery.data.items.map((item) => (
          <TimelineItem item={item} key={`${item.type}-${item.id}`} />
        ))}
      </div>
    );
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Conversation timeline
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
            Replies, notes, and events
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Internal notes only appear when the backend authorizes them for the
            signed-in user.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={timelineQuery.isFetching}
          onClick={() => {
            void timelineQuery.refetch();
          }}
          type="button"
        >
          {timelineQuery.isFetching ? 'Refreshing' : 'Refresh timeline'}
        </button>
      </div>

      {content}
    </section>
  );
};

export const TicketDetailPage = ({ ticketId }: { ticketId: string }) => {
  const ticketQuery = useTicket(ticketId);
  const currentUserQuery = useCurrentUser();

  const currentUserRole = currentUserQuery.data?.role ?? null;
  const isStaffViewer = currentUserRole
    ? staffRoles.has(currentUserRole)
    : false;

  useTicketRealtimeSubscription(ticketId, { staff: isStaffViewer });

  if (ticketQuery.isLoading) {
    return <LoadingState />;
  }

  if (ticketQuery.isError) {
    const statusCode =
      ticketQuery.error instanceof ApiClientError
        ? ticketQuery.error.statusCode
        : null;

    if (statusCode === 403) {
      return (
        <StatePanel
          action={
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/tickets"
            >
              Back to tickets
            </Link>
          }
          description="The signed-in user does not have visibility for this ticket detail route. Access stays aligned to backend ticket visibility rules."
          eyebrow="Access denied"
          title="You cannot open this ticket"
          tone="amber"
        />
      );
    }

    if (statusCode === 404) {
      return (
        <StatePanel
          action={
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              href="/tickets"
            >
              Back to tickets
            </Link>
          }
          description="No ticket was found for this route. The record may not exist, or the URL may be outdated."
          eyebrow="Ticket not found"
          title="This ticket does not exist"
          tone="slate"
        />
      );
    }

    return (
      <StatePanel
        action={
          <>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => {
                void ticketQuery.refetch();
              }}
              type="button"
            >
              Retry
            </button>
            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              href="/tickets"
            >
              Back to tickets
            </Link>
          </>
        }
        description={getApiErrorMessage(
          ticketQuery.error,
          'The ticket detail could not be loaded.',
        )}
        eyebrow="Ticket detail unavailable"
        title="The detail view could not be loaded"
        tone="rose"
      />
    );
  }

  const ticket = ticketQuery.data;

  if (!ticket) {
    return null;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_80px_-45px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-700">
              Ticket detail
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {ticket.subject}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ticket metadata, conversation, internal notes, and attachments are
              available here. Workflow actions remain deferred.
            </p>
          </div>

          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            href="/tickets"
          >
            Back to tickets
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Ticket #{ticket.number}
          </span>
          <ToneBadge toneClasses={statusToneClasses[ticket.status]}>
            {ticketStatusLabels[ticket.status]}
          </ToneBadge>
          <ToneBadge toneClasses={priorityToneClasses[ticket.priority]}>
            {ticketPriorityLabels[ticket.priority]}
          </ToneBadge>
          {ticketQuery.isFetching ? (
            <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800">
              Refreshing
            </span>
          ) : null}
        </div>
      </section>

      <TicketDescription ticket={ticket} />
      <TicketMetadata ticket={ticket} />
      <TicketWorkflowPanel
        currentUserRole={currentUserQuery.data?.role ?? null}
        ticket={ticket}
      />
      <TicketComposers
        currentUserRole={currentUserQuery.data?.role ?? null}
        ticket={ticket}
      />
      <TicketTimeline ticketId={ticket.id} />
    </div>
  );
};
