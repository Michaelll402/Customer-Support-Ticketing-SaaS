export const SLA_QUEUE_NAME = 'sla';
export const SLA_SCAN_JOB_NAME = 'sla.scan';

/** Repeatable scan cadence. Kept >= 60s to stay gentle on Upstash command quota. */
export const SLA_SCAN_INTERVAL_MS = 60_000;

/** A target is at risk once 80% of its SLA window has elapsed (20% remaining). */
export const SLA_AT_RISK_REMAINING_FRACTION = 0.2;

export type SlaTarget = 'FIRST_RESPONSE' | 'RESOLUTION';

/**
 * Deterministic notification job id so a transition can only ever enqueue one
 * notification, even if the scanner overlaps itself.
 */
export const buildSlaNotificationJobId = (
  ticketId: string,
  target: SlaTarget,
  state: 'AT_RISK' | 'BREACHED',
): string => `sla:${ticketId}:${target}:${state}`;
