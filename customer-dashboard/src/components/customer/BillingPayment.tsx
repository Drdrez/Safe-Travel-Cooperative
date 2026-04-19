import { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Calendar, Loader2, CheckCircle2, QrCode, Clock, Download, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { formatPHP, fromCents } from '../../lib/utils';
import { formatDate } from '../../lib/date';
import { supabase } from '../../lib/supabase';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { usePagination, TablePagination } from '../../lib/usePagination';
import { useOpPrefs } from '../../lib/useOpPrefs';
import { generateReceiptPdf } from '../../lib/receipt';
import { QRCodeSVG } from 'qrcode.react';
import { Portal } from '../ui/Portal';

interface Bill {
  id: string;
  billing_id_str: string;
  amount_cents: number;
  due_date: string;
  status: string;
  payment_method?: string;
  reference_id?: string | null;
  paid_at?: string | null;
  reservations?: {
    reservation_id_str: string;
    pickup_location?: string | null;
    destination?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    vehicles?: { model?: string | null; plate_number?: string | null } | null;
  } | null;
}

interface CustomerProfile {
  full_name: string | null;
  email: string | null;
  contact_number: string | null;
}

export default function BillingPayment() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const { prefs } = useOpPrefs();
  const onlinePaymentsEnabled = prefs.online_payments_enabled;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const { data: p } = await supabase
          .from('profiles')
          .select('full_name, email, contact_number')
          .eq('id', uid)
          .maybeSingle();
        if (p) setProfile(p as CustomerProfile);
      }
    })();
    fetchBills();
  }, []);

  // Listen for admin-side payment confirmations, trigger-driven inserts, etc.
  useRealtimeRefresh(
    'billings',
    () => fetchBills(),
    { filter: userId ? `customer_id=eq.${userId}` : undefined, enabled: !!userId },
  );

  const fetchBills = async () => {
    setLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    if (authData.user) {
      const { data, error } = await supabase
        .from('billings')
        .select(`
          *,
          reservations(
            reservation_id_str,
            pickup_location,
            destination,
            start_date,
            end_date,
            vehicles(model, plate_number)
          )
        `)
        .eq('customer_id', authData.user.id)
        .order('created_at', { ascending: false });
        
      if (data) {
        setBills(data as any[]);
      }
      if (error) {
        toast.error('Could not fetch bills: ' + error.message);
      }
    }
    setLoading(false);
  };

  const handlePayNow = (bill: Bill) => {
    setSelectedBill(bill);
    setPaymentMethod('');
    setReferenceId('');
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async () => {
    if (!selectedBill || !paymentMethod) return;

    if (['GCash', 'PayMaya', 'Bank Transfer'].includes(paymentMethod) && !referenceId) {
      toast.error('Please enter the transaction reference ID');
      return;
    }

    setIsProcessing(true);

    // Customers submit a payment claim (status = 'Pending Confirmation').
    // An admin must verify the reference in the Finance page before the bill
    // is marked 'Paid'. This prevents clients from self-crediting invoices.
    const { error } = await supabase
      .from('billings')
      .update({
        status: 'Pending Confirmation',
        payment_method: paymentMethod,
        reference_id: referenceId || null,
        paid_at: new Date().toISOString(),
      })
      .eq('id', selectedBill.id);

    if (error) {
      toast.error(error.message);
      setIsProcessing(false);
      return;
    }

    await fetchBills();
    setIsProcessing(false);
    setShowPaymentModal(false);
    setShowSuccessModal(true);
    toast.success('Payment submitted. Our dispatchers will confirm shortly.');
  };

  const downloadReceipt = (bill: Bill) => {
    try {
      const vehicle = bill.reservations?.vehicles
        ? `${bill.reservations.vehicles.model ?? ''}${
            bill.reservations.vehicles.plate_number ? ` (${bill.reservations.vehicles.plate_number})` : ''
          }`.trim() || null
        : null;
      generateReceiptPdf({
        receiptNumber: bill.billing_id_str,
        paidAt: bill.paid_at ?? null,
        customerName: profile?.full_name ?? null,
        customerEmail: profile?.email ?? null,
        customerPhone: profile?.contact_number ?? null,
        reservationRef: bill.reservations?.reservation_id_str ?? null,
        vehicle,
        pickup: bill.reservations?.pickup_location ?? null,
        destination: bill.reservations?.destination ?? null,
        startDate: bill.reservations?.start_date ?? null,
        endDate: bill.reservations?.end_date ?? null,
        amountCents: bill.amount_cents,
        paymentMethod: bill.payment_method ?? null,
        referenceId: bill.reference_id ?? null,
      });
    } catch (err) {
      console.error(err);
      toast.error('Could not generate receipt. Please try again.');
    }
  };

  const outstandingStatuses = new Set(['Pending', 'Overdue']);
  const totalPending = bills
    .filter((bill) => outstandingStatuses.has(bill.status))
    .reduce((sum, bill) => sum + fromCents(bill.amount_cents), 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const paidThisMonth = bills
    .filter((b) => b.status === 'Paid' && b.due_date && new Date(b.due_date) >= monthStart)
    .reduce((s, b) => s + fromCents(b.amount_cents), 0);

  const nextDue = [...bills]
    .filter(b => outstandingStatuses.has(b.status) && b.due_date)
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  const pagination = usePagination(bills);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-header">
        <div>
          <h1>My Payments</h1>
          <p>Track your payments, history, and upcoming due invoices.</p>
        </div>
      </div>

      {!onlinePaymentsEnabled && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            padding: 16,
            borderRadius: 'var(--radius-lg)',
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#78350f',
          }}
        >
          <Ban size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            <strong>Online payments are temporarily unavailable.</strong> Please settle any
            outstanding invoices at the cooperative office or contact dispatch for assistance.
            Invoices will remain listed here and can be paid online as soon as the service resumes.
          </div>
        </div>
      )}

      {/* Highlights */}
      <div className="grid-3">
         <div className="stat-card" style={{ padding: 24 }}>
             <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--brand-gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign className="text-brand-gold" size={24} />
                </div>
                <div>
                   <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>Balance Due</p>
                   <h2 style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(totalPending)}</h2>
                </div>
             </div>
         </div>
         <div className="stat-card" style={{ padding: 24 }}>
             <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--emerald-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard style={{ color: 'var(--emerald-500)' }} size={24} />
                </div>
                <div>
                   <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>Paid This Month</p>
                   <h2 style={{ fontSize: 24, fontWeight: 800 }}>{formatPHP(paidThisMonth)}</h2>
                </div>
             </div>
         </div>
         <div className="stat-card" style={{ padding: 24 }}>
             <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--indigo-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Calendar style={{ color: 'var(--indigo-600)' }} size={24} />
                </div>
                <div>
                   <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>Next Due</p>
                   <h2 style={{ fontSize: 18, fontWeight: 800 }}>{nextDue ? formatDate(nextDue.due_date) : 'None'}</h2>
                </div>
             </div>
         </div>
      </div>

      {/* Invoice Table */}
      <div className="data-card">
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--slate-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--slate-50)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800 }}>Payment History</h3>
            <button className="btn btn-outline btn-sm">Download History</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Trip Reference</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 80 }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></td></tr>
              ) : bills.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 80, color: 'var(--slate-400)' }}>No billing records found.</td></tr>
              ) : pagination.items.map((bill) => (
                <tr key={bill.id}>
                  <td><span style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{bill.billing_id_str}</span></td>
                  <td><span style={{ fontWeight: 600, color: 'var(--slate-500)' }}>{bill.reservations?.reservation_id_str || 'N/A'}</span></td>
                  <td><span style={{ fontWeight: 600 }}>{formatDate(bill.due_date)}</span></td>
                  <td><span style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{formatPHP(fromCents(bill.amount_cents))}</span></td>
                  <td>
                    <span className={`status-badge status-badge-${bill.status.toLowerCase()}`}>
                      {bill.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {bill.status === 'Pending' || bill.status === 'Overdue' ? (
                      onlinePaymentsEnabled ? (
                        <button onClick={() => handlePayNow(bill)} className="btn btn-brand btn-sm">Pay Now</button>
                      ) : (
                        <span
                          className="status-badge status-badge-warning"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          title="Online payments are temporarily disabled by the cooperative."
                        >
                          <Ban size={12} /> Pay on-site
                        </span>
                      )
                    ) : bill.status === 'Pending Confirmation' ? (
                      <span className="status-badge status-badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} /> Awaiting review
                      </span>
                    ) : bill.status === 'Paid' ? (
                      <button
                        onClick={() => downloadReceipt(bill)}
                        className="btn btn-outline btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        title="Download official receipt"
                      >
                        <Download size={14} /> Receipt
                      </button>
                    ) : (
                      <span className="status-badge status-badge-info" style={{ opacity: 0.6 }}>{bill.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination pagination={pagination} label="bills" />
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedBill && (
        <Portal>
          <div className="modal-backdrop">
             <div className="modal" style={{ maxWidth: 480, padding: 0, overflow: 'hidden' }}>
                <div style={{ background: 'var(--slate-900)', padding: 32, color: 'white' }}>
                   <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Pay Invoice</p>
                   <h2 style={{ color: 'white', marginBottom: 2 }}>{selectedBill.billing_id_str}</h2>
                   <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Due on {formatDate(selectedBill.due_date)}</p>
                   <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="flex-between">
                         <span style={{ fontSize: 13 }}>Amount to Pay</span>
                         <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-gold)' }}>{formatPHP(fromCents(selectedBill.amount_cents))}</span>
                      </div>
                   </div>
                </div>
                <div style={{ padding: 32 }} className="space-y-6">
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                       <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Choose Payment Method</label>
                       <select 
                           value={paymentMethod} 
                           onChange={(e) => setPaymentMethod(e.target.value)}
                           style={{ width: '100%', height: 48, padding: '0 16px', borderRadius: 12, background: 'var(--slate-50)', border: '1px solid var(--slate-100)', fontWeight: 700 }}
                       >
                           <option value="">Select Method</option>
                           <option value="GCash">GCash Checkout</option>
                           <option value="PayMaya">PayMaya Wallet</option>
                           <option value="Credit Card">Credit / Debit Card</option>
                           <option value="Bank Transfer">Direct Bank Transfer</option>
                       </select>
                    </div>

                    {/* QR Section for e-wallets */}
                    {['GCash', 'PayMaya'].includes(paymentMethod) && (
                      <div className="animate-in zoom-in duration-300" style={{ padding: 24, background: 'var(--slate-50)', borderRadius: 16, textAlign: 'center', border: '1.5px dashed var(--slate-200)' }}>
                          <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', marginBottom: 16 }}>Scan to Pay</p>
                          <div style={{ width: 200, height: 200, margin: '0 auto', background: 'white', padding: 16, borderRadius: 12, boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <QRCodeSVG 
                                  value={`SafeTravelPay:${selectedBill.billing_id_str}:${selectedBill.amount_cents}`}
                                  size={168}
                                  level="H"
                                  includeMargin={false}
                                  imageSettings={{
                                      src: "/logo.png",
                                      x: undefined, y: undefined, height: 24, width: 24, excavate: true,
                                  }}
                              />
                          </div>
                          <p style={{ fontSize: 13, fontWeight: 700, marginTop: 16, color: 'var(--slate-900)' }}>STTC Official {paymentMethod} Terminal</p>
                      </div>
                    )}

                    {['GCash', 'PayMaya', 'Bank Transfer'].includes(paymentMethod) && (
                      <div className="form-group animate-in slide-in-from-top-2 duration-300" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Transaction Reference ID</label>
                          <input 
                              placeholder="Enter 13-digit Reference #" 
                              value={referenceId}
                              onChange={(e) => setReferenceId(e.target.value)}
                              style={{ width: '100%', height: 48, padding: '0 16px', borderRadius: 12, background: 'white', border: '1px solid var(--brand-gold)', fontWeight: 700, fontSize: 15 }}
                          />
                          <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Please enter the exact reference number from your receipt.</p>
                      </div>
                    )}

                    <div style={{ padding: 16, background: 'var(--brand-gold-light)', borderRadius: 12, display: 'flex', gap: 12 }}>
                       <QrCode size={24} className="text-brand-gold-dark" />
                       <p style={{ fontSize: 11, lineHeight: '1.4', color: 'var(--brand-gold-dark)' }}>
                          Secure transactions are powered by STTC Gateway. Payments are verified manually by our dispatchers within 15 minutes.
                       </p>
                    </div>
                    <div className="flex-start" style={{ gap: 12 }}>
                       <button onClick={() => setShowPaymentModal(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
                       <button 
                           onClick={handleConfirmPayment} 
                           disabled={!paymentMethod || (['GCash', 'PayMaya', 'Bank Transfer'].includes(paymentMethod) && !referenceId) || isProcessing}
                           className="btn btn-brand" 
                           style={{ flex: 1.5 }}
                       >
                           {isProcessing ? <Loader2 className="animate-spin" /> : 'Confirm Payment'}
                       </button>
                    </div>
                </div>
             </div>
          </div>
        </Portal>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <Portal>
          <div className="modal-backdrop">
             <div className="modal" style={{ textAlign: 'center', maxWidth: 420 }}>
                <div style={{ width: 64, height: 64, background: 'var(--emerald-50)', color: 'var(--emerald-500)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                   <CheckCircle2 size={32} />
                </div>
                <h2 style={{ fontSize: 24, marginBottom: 12 }}>Payment submitted!</h2>
                <p style={{ fontSize: 14, color: 'var(--slate-500)', marginBottom: 24 }}>
                    We received your reference and are verifying it against our records.
                    Most payments are confirmed within 15 minutes during business hours.
                </p>
                <button onClick={() => setShowSuccessModal(false)} className="btn btn-brand w-full">Great, thanks!</button>
             </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
