import { jsPDF } from 'jspdf';
import { formatPHPForPdf, fromCents } from './utils';

export type ReceiptInput = {
  receiptNumber: string;
  paidAt: string | null;
  customerName: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  reservationRef?: string | null;
  vehicle?: string | null;
  pickup?: string | null;
  destination?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  amountCents: number;
  paymentMethod?: string | null;
  referenceId?: string | null;
};

/**
 * Customer-facing Official Receipt PDF for a paid rental billing.
 * Matches the admin-side receipt layout so both parties have an identical
 * document.
 */
export function generateReceiptPdf(input: ReceiptInput) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 54;
  let y = 64;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('Safe Travel Cooperative', left, y);
  y += 22;
  doc.setFontSize(12);
  doc.setTextColor(120);
  doc.text('Official Receipt — Rental Payment', left, y);
  y += 24;
  doc.setDrawColor(220);
  doc.line(left, y, pageWidth - left, y);
  y += 28;

  doc.setTextColor(20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`OR No.: ${input.receiptNumber}`, left, y);
  const dateLine = `Date: ${input.paidAt ? new Date(input.paidAt).toLocaleString() : new Date().toLocaleString()}`;
  doc.text(dateLine, pageWidth - left - doc.getTextWidth(dateLine), y);
  y += 22;

  const rows: Array<[string, string]> = [
    ['Received From', input.customerName || '—'],
    ['Email', input.customerEmail || '—'],
    ['Phone', input.customerPhone || '—'],
    ['Reservation', input.reservationRef || '—'],
    ['Vehicle', input.vehicle || 'Not yet assigned'],
    ['Pickup', input.pickup || '—'],
    ['Destination', input.destination || '—'],
    ['Start Date', input.startDate ? new Date(input.startDate).toLocaleDateString() : '—'],
    ['End Date', input.endDate ? new Date(input.endDate).toLocaleDateString() : '—'],
    ['Payment Method', input.paymentMethod || '—'],
    ['Reference ID', input.referenceId || '—'],
  ];

  doc.setFont('helvetica', 'normal');
  rows.forEach(([label, value]) => {
    doc.setTextColor(120);
    doc.text(label, left, y);
    doc.setTextColor(20);
    doc.text(String(value ?? '—'), left + 130, y);
    y += 18;
  });

  y += 12;
  doc.setDrawColor(220);
  doc.line(left, y, pageWidth - left, y);
  y += 26;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Amount Received', left, y);
  doc.setFontSize(16);
  const amountLine = formatPHPForPdf(fromCents(input.amountCents));
  doc.text(amountLine, pageWidth - left - doc.getTextWidth(amountLine), y);
  y += 28;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(
    'This receipt acknowledges full payment for the rental services listed above.',
    left,
    y,
  );
  y += 14;
  doc.text(
    'Please keep this document for your records. For questions contact safetravels.transportcoop@gmail.com.',
    left,
    y,
  );
  y += 20;

  y = Math.max(y + 40, doc.internal.pageSize.getHeight() - 120);
  doc.setDrawColor(120);
  doc.line(pageWidth - left - 240, y, pageWidth - left, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text('Cooperative representative', pageWidth - left - 240, y + 14);
  doc.text(
    `Generated ${new Date().toLocaleString()}`,
    left,
    doc.internal.pageSize.getHeight() - 32,
  );

  doc.save(`${input.receiptNumber}-receipt.pdf`);
}
