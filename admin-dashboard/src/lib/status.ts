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

export const REFUND_STATUSES = ['Pending', 'Processed', 'Declined'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const VEHICLE_STATUSES = [
  'Available',
  'Reserved',
  'In Service',
  'Maintenance',
  'Retired',
] as const;

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const badgeForReservation = (s: string | null | undefined): string => {
  switch (s) {
    case 'Pending':
      return 'badge-warning';
    case 'Confirmed':
      return 'badge-success';
    case 'In Progress':
      return 'badge-info';
    case 'Completed':
      return 'badge-default';
    case 'Cancelled':
      return 'badge-error';
    default:
      return 'badge-default';
  }
};

export const badgeForBilling = (s: string | null | undefined): string => {
  switch (s) {
    case 'Paid':
      return 'badge-success';
    case 'Pending':
      return 'badge-warning';
    case 'Pending Confirmation':
      return 'badge-info';
    case 'Overdue':
      return 'badge-error';
    case 'Refunded':
      return 'badge-default';
    case 'Cancelled':
      return 'badge-default';
    default:
      return 'badge-default';
  }
};
