/**
 * Canonical status vocabularies shared across the app.
 * Keep these in sync with the admin-dashboard copy and the SQL constraints.
 */

export const RESERVATION_STATUSES = [
  'Pending',
  'Confirmed',
  'In Progress',
  'Completed',
  'Cancelled',
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const BILLING_STATUSES = [
  'Pending',
  'Pending Confirmation',
  'Paid',
  'Overdue',
  'Cancelled',
  'Refunded',
] as const;

export type BillingStatus = (typeof BILLING_STATUSES)[number];
