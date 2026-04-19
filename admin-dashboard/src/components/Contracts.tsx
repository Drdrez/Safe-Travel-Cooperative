import { useState, useEffect } from 'react';
import { Download, Eye, CheckCircle2, X, FileText } from 'lucide-react';
import { formatPHP, fromCents } from '@/lib/formatters';
import { formatDate } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Portal } from './ui/Portal';
import { jsPDF } from 'jspdf';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '@/lib/usePagination';

const CONTRACT_TERMS = [
  'Vehicle must be returned with a full tank of fuel.',
  'Daily mileage limit: 200 km (₱10/km beyond limit).',
  'Late return fee: ₱500.00 per hour after grace period.',
  'Insurance coverage: comprehensive (subject to deductible).',
  'Security deposit: ₱5,000 (refundable within 7 business days).',
  'Smoking, alcohol, and prohibited substances are not permitted inside the vehicle.',
  'Any damages incurred outside normal wear and tear will be charged to the renter.',
];

const deriveContractId = (reservationIdStr: string | null | undefined) => {
  if (!reservationIdStr) return 'CNT-0000';
  const parts = reservationIdStr.split('-');
  return `CNT-${parts[1] || parts[0] || '0000'}`;
};

export function Contracts() {
  const [contractList, setContractList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  useEffect(() => { fetchContracts(); }, []);
  useRealtimeRefresh('reservations', () => fetchContracts());

  const fetchContracts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('reservations')
      .select('id, reservation_id_str, start_date, end_date, pickup_location, destination, estimated_cost_cents, status, profiles!reservations_customer_id_fkey(full_name, email, contact_number), vehicles(model, plate_number)')
      .in('status', ['Confirmed', 'In Progress', 'Completed'])
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(`Failed to load contracts: ${error.message}`);
      setLoading(false);
      return;
    }

    if (data) {
      setContractList(data.map(d => ({
        dbId: d.id,
        id: deriveContractId(d.reservation_id_str),
        reservationId: d.reservation_id_str,
        customer: (d.profiles as any)?.full_name || 'N/A',
        customerEmail: (d.profiles as any)?.email || '',
        customerPhone: (d.profiles as any)?.contact_number || '',
        startDate: d.start_date,
        endDate: d.end_date,
        pickup: d.pickup_location || 'TBD',
        destination: d.destination || 'TBD',
        vehicle: d.vehicles ? `${(d.vehicles as any).model} — ${(d.vehicles as any).plate_number}` : 'N/A',
        amountCents: d.estimated_cost_cents || 0,
        status: d.status,
      })));
    }
    setLoading(false);
  };

  const completeContract = async (dbId: string) => {
    const { error } = await supabase.from('reservations').update({ status: 'Completed' }).eq('id', dbId);
    if (error) { toast.error(`Failed to complete: ${error.message}`); return; }
    toast.success('Contract marked as completed');
    fetchContracts();
    setSelectedContract(null);
  };

  const downloadPDF = (contract: any) => {
    try {
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
      doc.text('Rental Contract', left, y);
      y += 24;
      doc.setDrawColor(220);
      doc.line(left, y, pageWidth - left, y);
      y += 28;

      doc.setTextColor(20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Contract ID: ${contract.id}`, left, y);
      doc.text(`Reservation: ${contract.reservationId || 'N/A'}`, pageWidth - left - 180, y);
      y += 22;

      const rows: Array<[string, string]> = [
        ['Customer', contract.customer],
        ['Email', contract.customerEmail || '—'],
        ['Phone', contract.customerPhone || '—'],
        ['Vehicle', contract.vehicle],
        ['Pickup', contract.pickup],
        ['Destination', contract.destination],
        ['Start Date', formatDate(contract.startDate, { year: 'numeric', month: 'long', day: 'numeric' })],
        ['End Date', formatDate(contract.endDate, { year: 'numeric', month: 'long', day: 'numeric' })],
        ['Status', contract.status],
        ['Total Amount', formatPHP(fromCents(contract.amountCents))],
      ];

      doc.setFont('helvetica', 'normal');
      rows.forEach(([label, value]) => {
        doc.setTextColor(120);
        doc.text(label, left, y);
        doc.setTextColor(20);
        doc.text(String(value ?? '—'), left + 120, y);
        y += 18;
      });

      y += 12;
      doc.setDrawColor(220);
      doc.line(left, y, pageWidth - left, y);
      y += 22;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Terms & Conditions', left, y);
      y += 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      CONTRACT_TERMS.forEach((t, i) => {
        const lines = doc.splitTextToSize(`${i + 1}. ${t}`, pageWidth - left * 2);
        doc.text(lines, left, y);
        y += lines.length * 14;
      });

      y = Math.max(y + 40, doc.internal.pageSize.getHeight() - 120);
      doc.setDrawColor(120);
      doc.line(left, y, left + 200, y);
      doc.line(pageWidth - left - 200, y, pageWidth - left, y);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('Customer signature', left, y + 14);
      doc.text('Cooperative representative', pageWidth - left - 200, y + 14);
      doc.text(
        `Generated ${new Date().toLocaleString()}`,
        left,
        doc.internal.pageSize.getHeight() - 32
      );

      doc.save(`${contract.id}-contract.pdf`);
      toast.success('Contract PDF downloaded');
    } catch (err: any) {
      toast.error(`Could not generate PDF: ${err?.message || 'unknown error'}`);
    }
  };

  const pagination = usePagination(contractList);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Contracts</h1><p>View and manage rental contracts.</p></div>
      </div>

      <div className="card-flat">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr><th>Contract ID</th><th>Customer</th><th>Vehicle</th><th>Start Date</th><th>End Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>Loading contracts…</td></tr>
              ) : contractList.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--slate-400)' }}>
                  <FileText size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p style={{ fontWeight: 700 }}>No active or completed rentals yet</p>
                </td></tr>
              ) : pagination.items.map((c) => (
                <tr key={c.dbId}>
                  <td style={{ fontWeight: 700 }}>{c.id}</td>
                  <td>{c.customer}</td>
                  <td>{c.vehicle}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(c.startDate)}</td>
                  <td style={{ fontSize: 12 }}>{formatDate(c.endDate)}</td>
                  <td style={{ fontWeight: 600 }}>{formatPHP(fromCents(c.amountCents))}</td>
                  <td>
                    <span className={cn(
                      'badge',
                      c.status === 'In Progress' ? 'badge-info' :
                      c.status === 'Confirmed'   ? 'badge-success' :
                                                   'badge-default'
                    )}>{c.status}</span>
                  </td>
                  <td>
                    <div className="flex-start gap-2">
                      <button className="btn btn-outline btn-sm" onClick={() => setSelectedContract(c)}>
                        <Eye size={14} /> View
                      </button>
                      {(c.status === 'Confirmed' || c.status === 'In Progress') && (
                        <button className="btn btn-success btn-sm" onClick={() => completeContract(c.dbId)}>
                          <CheckCircle2 size={14} /> Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="contracts" />
        </div>
      </div>

      {/* Contract Detail Modal */}
      {selectedContract && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSelectedContract(null); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>Contract Details — {selectedContract.id}</h2>
                <button className="modal-close" onClick={() => setSelectedContract(null)}><X size={20} /></button>
              </div>

              <div style={{ background: 'var(--slate-50)', padding: 24, borderRadius: 'var(--radius-md)', marginBottom: 24 }}>
                <div className="grid-2" style={{ gap: 16 }}>
                  <div><p className="form-label">Customer Name</p><p style={{ fontWeight: 600, fontSize: 14 }}>{selectedContract.customer}</p></div>
                  <div><p className="form-label">Contract ID</p><p style={{ fontWeight: 600 }}>{selectedContract.id}</p></div>
                  <div><p className="form-label">Vehicle</p><p style={{ fontWeight: 600 }}>{selectedContract.vehicle}</p></div>
                  <div><p className="form-label">Amount</p><p style={{ fontWeight: 600 }}>{formatPHP(fromCents(selectedContract.amountCents))}</p></div>
                  <div><p className="form-label">Start Date</p><p>{formatDate(selectedContract.startDate)}</p></div>
                  <div><p className="form-label">End Date</p><p>{formatDate(selectedContract.endDate)}</p></div>
                  <div><p className="form-label">Pickup</p><p style={{ fontSize: 13 }}>{selectedContract.pickup}</p></div>
                  <div><p className="form-label">Destination</p><p style={{ fontSize: 13 }}>{selectedContract.destination}</p></div>
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Contract Terms</h4>
                <div style={{ background: 'var(--slate-50)', padding: 20, borderRadius: 'var(--radius-md)', fontSize: 13, color: 'var(--slate-600)', lineHeight: 1.8 }}>
                  {CONTRACT_TERMS.map((t, i) => (
                    <p key={i}>• {t}</p>
                  ))}
                </div>
              </div>

              <button className="btn btn-brand btn-lg w-full" onClick={() => downloadPDF(selectedContract)}>
                <Download size={16} /> Download Contract PDF
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
