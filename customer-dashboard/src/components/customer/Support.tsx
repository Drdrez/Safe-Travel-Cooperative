import { useEffect, useState } from 'react';
import { MessageSquare, Phone, Mail, ChevronDown, ChevronUp, Search, ExternalLink, ShieldQuestion, LifeBuoy, Clock, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'react-router';
import { supabase } from '../../lib/supabase';
import { COOP_CONTACT } from '../../lib/contactInfo';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { formatDateTime } from '../../lib/date';

type MiniReservation = { id: string; reservation_id_str: string; destination: string | null };

const FAQS = [
  {
    question: "How do I book a premium transport?",
    answer: "You can book a trip by clicking 'Book New Trip' on your dashboard. Simply select your pickup date, choose a destination, and select your preferred vehicle from our premium fleet."
  },
  {
    question: "Can I cancel my reservation?",
    answer: "Yes, you can cancel your reservation through the 'My Reservations' page. Please note that cancellations made within 2 hours of the pickup time may be subject to a small processing fee."
  },
  {
    question: "How do I track my assigned driver?",
    answer: "Once your trip is confirmed and the driver is on their way, a 'Track My Trip' button will appear on your dashboard. You can view the real-time location and estimated time of arrival."
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept all major credit cards, digital wallets (GCash, Maya), and bank transfers. For long-term cooperative members, we also offer 'Post-Paid' billing options."
  },
  {
    question: "How do I become a cooperative member?",
    answer: "Simply register for an account and apply for membership. Once approved by our administrative board, you will gain access to member-exclusive rates and premium fleet options."
  }
];

const SUBJECTS = [
  'Booking Inquiry',
  'Payment & Billing',
  'Driver/Vehicle Feedback',
  'Account Issues',
  'General Question',
] as const;

type Ticket = {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_reply: string | null;
  created_at: string;
  replied_at: string | null;
  reservation_id: string | null;
  reservations?: { reservation_id_str: string | null } | null;
};

export default function Support() {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isSending, setIsSending] = useState(false);
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [message, setMessage] = useState('');
  const [reservationId, setReservationId] = useState<string>('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reservations, setReservations] = useState<MiniReservation[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data.user?.id ?? null);
    })();
    fetchTickets();
    fetchReservations();
  }, []);

  // Show new admin replies / status changes without the customer needing to refresh.
  useRealtimeRefresh(
    'support_tickets',
    () => fetchTickets(),
    { filter: userId ? `customer_id=eq.${userId}` : undefined, enabled: !!userId },
  );

  // Deep-link from "Report a problem" button: pre-select reservation + subject.
  useEffect(() => {
    const state = (location.state || {}) as { reservationId?: string; subject?: string; message?: string };
    if (state.reservationId) setReservationId(state.reservationId);
    if (state.subject && (SUBJECTS as readonly string[]).includes(state.subject)) setSubject(state.subject);
    if (state.message) setMessage(state.message);
  }, [location.state]);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) { setLoadingTickets(false); return; }
    const { data, error } = await supabase
      .from('support_tickets')
      .select('id, subject, message, status, admin_reply, created_at, replied_at, reservation_id, reservations(reservation_id_str)')
      .eq('customer_id', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      // Table may not exist if migration wasn't run yet — don't be noisy.
      console.warn('[support] could not load tickets:', error.message);
    }
    if (data) setTickets(data as Ticket[]);
    setLoadingTickets(false);
  };

  const fetchReservations = async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) return;
    const { data, error } = await supabase
      .from('reservations')
      .select('id, reservation_id_str, destination')
      .eq('customer_id', authData.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setReservations(data as MiniReservation[]);
  };

  const filteredFaqs = FAQS.filter(faq =>
    faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { toast.error('Please type a message'); return; }

    setIsSending(true);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData?.user) {
      toast.error('You must be signed in to send a message');
      setIsSending(false);
      return;
    }
    const { error } = await supabase.from('support_tickets').insert([{
      customer_id: authData.user.id,
      subject,
      message: message.trim(),
      status: 'Open',
      reservation_id: reservationId || null,
    }]);

    if (error) {
      toast.error(`Couldn't send message: ${error.message}`);
      setIsSending(false);
      return;
    }

    toast.success('Message sent! Our support team will respond within 24 hours.');
    setMessage('');
    setReservationId('');
    setIsSending(false);
    fetchTickets();
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 style={{ fontSize: 32 }}>Cooperative Support</h1>
          <p>We're here to ensure your journey is safe, comfortable, and seamless.</p>
        </div>
      </div>

      <div className="support-two-col">
        
        {/* FAQ Section */}
        <div className="space-y-8">
            <div className="card" style={{ padding: 32 }}>
                <div className="flex-between" style={{ marginBottom: 32 }}>
                    <div className="flex-start" style={{ gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--brand-gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldQuestion className="text-brand-gold" size={22} />
                        </div>
                        <h3 style={{ fontSize: 20 }}>Frequently Asked Questions</h3>
                    </div>
                </div>

                <div style={{ position: 'relative', marginBottom: 32 }}>
                    <Search style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} size={18} />
                    <input 
                        type="text" 
                        placeholder="Search for answers..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', height: 52, padding: '0 16px 0 48px', borderRadius: 12, border: '1px solid var(--slate-100)', background: 'var(--slate-50)' }}
                    />
                </div>

                <div className="space-y-4">
                    {filteredFaqs.length > 0 ? (
                        filteredFaqs.map((faq, i) => (
                            <div key={i} style={{ borderBottom: i === filteredFaqs.length - 1 ? 'none' : '1px solid var(--slate-50)', paddingBottom: 16 }}>
                                <button 
                                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', textAlign: 'left' }}
                                >
                                    <span style={{ fontWeight: 700, fontSize: 15, color: openFaq === i ? 'var(--brand-gold-dark)' : 'var(--slate-700)' }}>{faq.question}</span>
                                    {openFaq === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                                {openFaq === i && (
                                    <div style={{ padding: '4px 0 8px 0', color: 'var(--slate-500)', fontSize: 14, lineHeight: 1.6 }} className="animate-in fade-in slide-in-from-top-2 duration-300">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--slate-400)' }}>No matches found. Try a different search term.</p>
                    )}
                </div>
            </div>

            <div
              className="card support-helpline-banner"
              style={{ padding: 24, background: 'var(--slate-900)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LifeBuoy className="text-brand-gold" size={24} />
                    </div>
                    <div>
                        <h4 style={{ color: 'white', fontSize: 16 }}>Still need help?</h4>
                        <p style={{ color: 'var(--slate-400)', fontSize: 13 }}>Our emergency travel line is always open.</p>
                    </div>
                </div>
                <button 
                    className="btn btn-brand" 
                    style={{ height: 44 }}
                    onClick={() => { window.location.href = `tel:${COOP_CONTACT.phoneE164}`; }}
                >
                    Call Helpline
                </button>
            </div>
        </div>

        {/* Contact Form Section */}
        <div className="space-y-8">
            <div className="card" style={{ padding: 32 }}>
                <div className="flex-start" style={{ gap: 12, marginBottom: 28 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--indigo-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <MessageSquare style={{ color: 'var(--indigo-600)' }} size={22} />
                    </div>
                    <h3 style={{ fontSize: 20 }}>Message Support</h3>
                </div>

                <form onSubmit={handleSendMessage} className="space-y-6">
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Subject</label>
                        <select
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            style={{ background: 'var(--slate-50)', border: '1px solid var(--slate-100)', borderRadius: 12, height: 52, padding: '0 16px' }}
                        >
                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>
                          Related trip <span style={{ fontWeight: 500, textTransform: 'none', color: 'var(--slate-400)' }}>(optional)</span>
                        </label>
                        <select
                            value={reservationId}
                            onChange={(e) => setReservationId(e.target.value)}
                            style={{ background: 'var(--slate-50)', border: '1px solid var(--slate-100)', borderRadius: 12, height: 52, padding: '0 16px' }}
                        >
                            <option value="">Not about a specific trip</option>
                            {reservations.map(r => (
                              <option key={r.id} value={r.id}>
                                {r.reservation_id_str}{r.destination ? ` — to ${r.destination}` : ''}
                              </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Your Message</label>
                        <textarea 
                            rows={5} 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Tell us how we can assist you..."
                            style={{ padding: 16, background: 'var(--slate-50)', border: '1px solid var(--slate-100)', borderRadius: 12, resize: 'none' }}
                        />
                    </div>

                    <button type="submit" disabled={isSending} className="btn btn-brand w-full" style={{ height: 56, fontSize: 16 }}>
                        {isSending ? <Loader2 size={18} className="animate-spin" /> : <>Send Message <Send size={18} /></>}
                    </button>
                </form>
            </div>

            {/* My Tickets */}
            <div className="card" style={{ padding: 24 }}>
                <div className="flex-between" style={{ marginBottom: 16 }}>
                    <h3 style={{ fontSize: 16 }}>My recent messages</h3>
                    {loadingTickets && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--slate-400)' }} />}
                </div>
                {tickets.length === 0 && !loadingTickets ? (
                    <p style={{ fontSize: 13, color: 'var(--slate-400)' }}>No messages yet. Send your first one above.</p>
                ) : (
                    <div className="space-y-3">
                        {tickets.map(t => (
                            <div key={t.id} style={{ padding: 14, background: 'var(--slate-50)', borderRadius: 12, border: '1px solid var(--slate-100)' }}>
                                <div className="flex-between" style={{ marginBottom: 6 }}>
                                    <span style={{ fontWeight: 700, fontSize: 13 }}>{t.subject}</span>
                                    <span className={`status-badge status-badge-${t.status.toLowerCase().replace(/\s+/g, '-')}`}>{t.status}</span>
                                </div>
                                {t.reservations?.reservation_id_str && (
                                  <p style={{ fontSize: 11, color: 'var(--indigo-600)', fontWeight: 700, marginBottom: 4 }}>
                                    Re: trip {t.reservations.reservation_id_str}
                                  </p>
                                )}
                                <p style={{ fontSize: 12, color: 'var(--slate-600)', marginBottom: 8 }}>{t.message}</p>
                                {t.admin_reply && (
                                    <div style={{ marginTop: 8, padding: 10, background: 'white', border: '1px solid var(--slate-100)', borderRadius: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--emerald-600)', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                                            <CheckCircle2 size={12} /> Reply from support
                                        </div>
                                        <p style={{ fontSize: 12, color: 'var(--slate-700)' }}>{t.admin_reply}</p>
                                    </div>
                                )}
                                <p style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 8 }}>Sent {formatDateTime(t.created_at)}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid-1" style={{ gap: 16 }}>
                <a href={`tel:${COOP_CONTACT.phoneE164}`} className="card flex-start" style={{ padding: 16, gap: 16, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--slate-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Phone size={18} className="text-slate-600" />
                    </div>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Live Contact</p>
                        <p style={{ fontWeight: 700 }}>{COOP_CONTACT.phoneDisplay}</p>
                    </div>
                    <ExternalLink size={14} style={{ marginLeft: 'auto', color: 'var(--slate-300)' }} />
                </a>
                <a href={`mailto:${COOP_CONTACT.email}`} className="card flex-start" style={{ padding: 16, gap: 16, textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--slate-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Mail size={18} className="text-slate-600" />
                    </div>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Email Support</p>
                        <p style={{ fontWeight: 700 }}>{COOP_CONTACT.email}</p>
                    </div>
                    <ExternalLink size={14} style={{ marginLeft: 'auto', color: 'var(--slate-300)' }} />
                </a>
                <div className="card flex-start" style={{ padding: 16, gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--slate-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={18} className="text-slate-600" />
                    </div>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase' }}>Response Time</p>
                        <p style={{ fontWeight: 700 }}>Typically within 24 hours</p>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
