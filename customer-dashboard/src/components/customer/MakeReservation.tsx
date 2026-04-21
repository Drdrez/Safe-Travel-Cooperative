import { useState, useEffect } from 'react';
import { MapPin, Car, Loader2, CheckCircle2, Navigation, Clock, ShieldCheck, ArrowRight, User, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { formatPHP, fromCents, cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import { Portal } from '../ui/Portal';

const SELF_DRIVE_DISCOUNT = 0.15;

export default function MakeReservation() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    pickupLocation: '',
    destination: '',
    startDate: '',
    endDate: '',
    vehicleType: '',
    serviceType: 'withDriver',
    specialRequests: '',
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [orderSummary, setOrderSummary] = useState({ id: '', cost: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isFetchingVehicles, setIsFetchingVehicles] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    fetchVehicles();
  }, []);

  useRealtimeRefresh('vehicles', () => fetchVehicles());

  const fetchVehicles = async () => {
    setIsFetchingVehicles(true);
    const { data, error } = await supabase.from('vehicles').select('*').eq('status', 'Available');
    if (error) toast.error(`Couldn't load vehicles: ${error.message}`);
    if (data) setVehicles(data);
    setIsFetchingVehicles(false);
  };

  const getPrice = (v: any): number => fromCents(v?.daily_rate_cents);

  const days = (() => {
    if (!formData.startDate || !formData.endDate) return 1;
    const s = new Date(formData.startDate).getTime();
    const e = new Date(formData.endDate).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 1;
    return Math.max(1, Math.ceil((e - s) / 86_400_000));
  })();

  const computeQuote = (v: any | undefined): number => {
    if (!v) return 0;
    const base = getPrice(v) * days;
    return formData.serviceType === 'selfDrive' ? base * (1 - SELF_DRIVE_DISCOUNT) : base;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const nextStep = () => {
    if (step === 1) {
        if (!formData.pickupLocation || !formData.destination || !formData.startDate || !formData.endDate) {
            toast.error('Please fill in all trip details');
            return;
        }
        const start = new Date(formData.startDate);
        const end = new Date(formData.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            toast.error('Please enter valid dates');
            return;
        }
        if (start < new Date(Date.now() - 60_000)) {
            toast.error('Start date must be in the future');
            return;
        }
        if (end <= start) {
            toast.error('Return date must be after the start date');
            return;
        }
    }
    if (step === 2) {
        if (!formData.vehicleType) {
            toast.error('Please select a vehicle');
            return;
        }
    }
    setStep(prev => prev + 1);
  };

  const prevStep = () => setStep(prev => prev - 1);

  const handleSubmit = async () => {
    setIsLoading(true);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      toast.error('Please login to make a reservation');
      setIsLoading(false);
      return;
    }
    const userId = authData.user.id;

    const idStr = 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicleType);
    const cost = computeQuote(selectedVehicle);

    if (selectedVehicle && getPrice(selectedVehicle) <= 0) {
      toast.error('This vehicle has no published daily rate. Please contact dispatch.');
      setIsLoading(false);
      return;
    }

    const estimatedCostCents = Math.round(cost * 100);

    const { data: overlap, error: overlapErr } = await supabase
      .from('reservations')
      .select('id')
      .eq('vehicle_id', formData.vehicleType)
      .in('status', ['Pending', 'Confirmed', 'In Progress'])
      .lte('start_date', new Date(formData.endDate).toISOString())
      .gte('end_date', new Date(formData.startDate).toISOString())
      .limit(1);
    if (overlapErr) {
      toast.error(`Availability check failed: ${overlapErr.message}`);
      setIsLoading(false);
      return;
    }
    if (overlap && overlap.length > 0) {
      toast.error('This vehicle was just booked for overlapping dates. Please pick another.');
      setIsLoading(false);
      return;
    }

    const { data: resData, error: resError } = await supabase.from('reservations').insert([{
      reservation_id_str: idStr,
      customer_id: userId,
      vehicle_id: formData.vehicleType || null,
      pickup_location: formData.pickupLocation,
      destination: formData.destination,
      start_date: new Date(formData.startDate).toISOString(),
      end_date: new Date(formData.endDate).toISOString(),
      status: 'Pending',
      estimated_cost_cents: estimatedCostCents,
      customer_special_requests: formData.specialRequests.trim() || null,
    }]).select().single();

    if (resError) {
      toast.error(resError.message);
      setIsLoading(false);
      return;
    }

    if (resData) {
      const invStr = 'INV-' + (idStr.split('-')[1] || Math.floor(Math.random() * 9999).toString());
      const { error: billingErr } = await supabase.from('billings').insert([{
        billing_id_str: invStr,
        reservation_id: resData.id,
        customer_id: userId,
        amount_cents: estimatedCostCents,
        status: 'Pending',
        due_date: new Date(formData.startDate).toISOString().split('T')[0]
      }]);
      if (billingErr) toast.warning(`Reservation made, but invoice creation failed: ${billingErr.message}`);
    }

    setOrderSummary({ id: idStr, cost });
    setIsLoading(false);
    setShowConfirmation(true);
    toast.success('Reservation successfully requested!');
  };

  const selectedVehicle = vehicles.find(v => v.id === formData.vehicleType);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-header">
        <div>
          <h1>Vehicle Reservation</h1>
          <p>Complete your booking in three simple steps.</p>
        </div>
        <div className="page-header-steps">
            {[1, 2, 3].map(i => (
                <div key={i} style={{ 
                    width: 32, height: 32, borderRadius: '50%', 
                    background: step >= i ? 'var(--brand-gold)' : 'var(--slate-100)',
                    color: step >= i ? 'var(--slate-900)' : 'var(--slate-400)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 800, transition: 'all 0.3s ease'
                }}>
                    {i}
                </div>
            ))}
        </div>
      </div>

      <div className="make-reservation-layout">
        {/* Reservation Wizard */}
        <div
          className="card booking-wizard-card"
          style={{ border: '1px solid var(--slate-200)', display: 'flex', flexDirection: 'column' }}
        >
          
          <div style={{ flex: 1 }}>
            {step === 1 && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="section-title">
                        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Trip Details</h2>
                        <p style={{ color: 'var(--slate-500)' }}>Tell us where and when you're traveling.</p>
                    </div>

                    <div className="grid-2">
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <MapPin size={16} className="text-brand-gold" /> Pickup Location
                            </label>
                            <input
                            name="pickupLocation"
                            placeholder="Enter full address"
                            value={formData.pickupLocation}
                            onChange={handleChange}
                            required
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Navigation size={16} className="text-brand-gold" /> Destination
                            </label>
                            <input
                            name="destination"
                            placeholder="Where are you going?"
                            value={formData.destination}
                            onChange={handleChange}
                            required
                            />
                        </div>
                    </div>

                    <div className="grid-2">
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Clock size={16} className="text-brand-gold" /> Start Date & Time
                            </label>
                            <input
                            name="startDate"
                            type="datetime-local"
                            value={formData.startDate}
                            onChange={handleChange}
                            required
                            />
                        </div>
                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <Clock size={16} className="text-brand-gold" /> Estimated Return
                            </label>
                            <input
                            name="endDate"
                            type="datetime-local"
                            value={formData.endDate}
                            onChange={handleChange}
                            required
                            />
                        </div>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-600)', display: 'flex', alignItems: 'center', gap: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            <User size={16} className="text-brand-gold" /> Service Mode
                        </label>
                        <select name="serviceType" value={formData.serviceType} onChange={handleChange}>
                            <option value="withDriver">Our service with a professional driver</option>
                            <option value="selfDrive">Self-Drive Rental</option>
                        </select>
                        <p style={{ fontSize: 12, color: 'var(--slate-400)' }}>
                            {formData.serviceType === 'withDriver' 
                                ? 'Our professional driver will handle everything for your comfort.' 
                                : 'You will be responsible for driving the vehicle yourself.'}
                        </p>
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--slate-600)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Notes for dispatch (optional)
                        </label>
                        <textarea
                            name="specialRequests"
                            value={formData.specialRequests}
                            onChange={handleChange}
                            rows={3}
                            placeholder="Passenger count, luggage, occasion, preferred contact time, accessibility… Keeps everything in one place with your booking."
                            style={{ minHeight: 88, resize: 'vertical' }}
                        />
                        <p style={{ fontSize: 12, color: 'var(--slate-400)', margin: 0, lineHeight: 1.5 }}>
                            Booking here keeps dates, vehicle, messages, and handover records in one system—easier than coordinating only on Messenger.
                        </p>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-500">
                    <div className="section-title flex-between">
                        <div>
                            <h2 style={{ fontSize: 24, fontWeight: 800 }}>Select Your Vehicle</h2>
                            <p style={{ color: 'var(--slate-500)' }}>Choose the best unit for your journey.</p>
                        </div>
                    </div>

                    {/* Category Filter */}
                    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
                        {['All', 'Sedan', 'SUV', 'Van', 'Coaster', 'Bus'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                style={{
                                    padding: '8px 20px',
                                    borderRadius: 30,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.2s',
                                    background: selectedCategory === cat ? 'var(--slate-900)' : 'var(--slate-50)',
                                    color: selectedCategory === cat ? 'white' : 'var(--slate-500)',
                                    border: selectedCategory === cat ? 'none' : '1px solid var(--slate-100)'
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="grid-2" style={{ gap: 20 }}>
                        {isFetchingVehicles ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="card animate-pulse" style={{ height: 180, background: 'var(--slate-50)' }} />
                            ))
                        ) : (
                            vehicles
                                .filter(v => selectedCategory === 'All' || v.vehicle_type === selectedCategory)
                                .map(v => (
                                <div 
                                    key={v.id} 
                                    onClick={() => setFormData(prev => ({ ...prev, vehicleType: v.id }))}
                                    className={cn(
                                        "card", 
                                        formData.vehicleType === v.id ? "active-selection" : "hover-selection"
                                    )}
                                    style={{ 
                                        padding: 24, cursor: 'pointer', transition: 'all 0.2s',
                                        border: formData.vehicleType === v.id ? '2px solid var(--brand-gold)' : '2px solid var(--slate-100)',
                                        background: formData.vehicleType === v.id ? 'var(--brand-gold-light)' : 'white',
                                        position: 'relative'
                                    }}
                                >
                                    {formData.vehicleType === v.id && (
                                        <div style={{ position: 'absolute', top: 12, right: 12, color: 'var(--brand-gold)' }}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                    )}
                                    <div style={{ height: 120, borderRadius: 12, background: 'var(--slate-50)', marginBottom: 16, overflow: 'hidden' }}>
                                        {v.image_url ? (
                                            <img src={v.image_url} alt={v.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-300)' }}>
                                                <Car size={48} />
                                            </div>
                                        )}
                                    </div>
                                    <h4 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{v.model}</h4>
                                    <div className="flex-between">
                                        <span style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 600 }}>{v.capacity} Passengers</span>
                                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--brand-gold-dark)' }}>{formatPHP(getPrice(v))}<span style={{ fontSize: 10, color: 'var(--slate-400)', fontWeight: 600 }}> / day</span></span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-500">
                    <div className="section-title">
                        <h2 style={{ fontSize: 24, fontWeight: 800 }}>Review Reservation</h2>
                        <p style={{ color: 'var(--slate-500)' }}>Verify your details before submitting.</p>
                    </div>

                    <div className="card" style={{ padding: 24, background: 'var(--slate-50)', border: 'none' }}>
                        <div className="grid-2" style={{ gap: 24 }}>
                            <div>
                                <p style={{ fontSize: 12, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>Route Info</p>
                                <div className="space-y-4">
                                    <div className="flex-start">
                                        <MapPin size={16} className="text-slate-400" />
                                        <div>
                                            <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Pickup</p>
                                            <p style={{ fontWeight: 700 }}>{formData.pickupLocation}</p>
                                        </div>
                                    </div>
                                    <div className="flex-start">
                                        <Navigation size={16} className="text-brand-gold" />
                                        <div>
                                            <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Destination</p>
                                            <p style={{ fontWeight: 700 }}>{formData.destination}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p style={{ fontSize: 12, color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 800, marginBottom: 8 }}>Vehicle & Service</p>
                                <div className="space-y-4">
                                    <div className="flex-start">
                                        <Car size={16} className="text-slate-400" />
                                        <div>
                                            <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Vehicle</p>
                                            <p style={{ fontWeight: 700 }}>{selectedVehicle?.model} ({selectedVehicle?.plate_number})</p>
                                        </div>
                                    </div>
                                    <div className="flex-start">
                                        <User size={16} className="text-slate-400" />
                                        <div>
                                            <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Service</p>
                                            <p style={{ fontWeight: 700 }}>{formData.serviceType === 'withDriver' ? 'Our service with a professional driver' : 'Self-Drive Rental'}</p>
                                        </div>
                                    </div>
                                    {formData.specialRequests.trim() && (
                                      <div className="flex-start" style={{ marginTop: 8 }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: 11, color: 'var(--slate-400)' }}>Notes for dispatch</p>
                                            <p style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.45 }}>{formData.specialRequests.trim()}</p>
                                        </div>
                                      </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: 24, background: 'var(--brand-gold-light)', border: '1px solid var(--brand-gold)' }}>
                        <div className="flex-start" style={{ gap: 16 }}>
                            <ShieldCheck size={32} className="text-brand-gold" />
                            <div>
                                <h4 style={{ fontWeight: 800, color: 'var(--brand-gold-dark)' }}>Ready to confirm?</h4>
                                <p style={{ fontSize: 13, color: 'var(--brand-gold-dark)', opacity: 0.8 }}>By clicking submit, your reservation request will be sent to our dispatcher for review.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
          </div>

          <div className="booking-step-footer" style={{ paddingTop: 40, marginTop: 'auto', borderTop: '1px solid var(--slate-100)' }}>
            {step > 1 ? (
                <button onClick={prevStep} className="btn btn-outline" style={{ height: 50, padding: '0 24px' }}>
                    <ChevronLeft size={18} /> Previous Step
                </button>
            ) : <div />}

            {step < 3 ? (
                <button 
                    onClick={nextStep} 
                    className="btn btn-brand" 
                    style={{ height: 56, padding: '0 40px', fontSize: 15, borderRadius: 16 }}
                >
                    Continue to {step === 1 ? 'Select Vehicle' : 'Final Review'} <ArrowRight size={20} />
                </button>
            ) : (
                <button 
                  onClick={handleSubmit} 
                  className="btn btn-brand" 
                  disabled={isLoading}
                  style={{ height: 60, borderRadius: 16, fontSize: 16 }}
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <>Confirm & Request Reservation <ShieldCheck size={20} /></>}
                </button>
            )}
          </div>
        </div>

        {/* Price Breakdown / Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'var(--slate-900)', color: 'white', padding: 32, borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ fontSize: 18, marginBottom: 16, color: 'white', fontWeight: 800 }}>Trip Summary</h3>
            <div className="space-y-4">
               <div className="flex-between">
                  <span style={{ color: 'var(--slate-400)', fontSize: 14 }}>Daily rate</span>
                  <span style={{ fontWeight: 700 }}>{selectedVehicle ? formatPHP(getPrice(selectedVehicle)) : '—'}</span>
               </div>
               <div className="flex-between">
                  <span style={{ color: 'var(--slate-400)', fontSize: 14 }}>Days</span>
                  <span style={{ fontWeight: 700 }}>× {days}</span>
               </div>
               {formData.serviceType === 'selfDrive' && (
                 <div className="flex-between">
                    <span style={{ color: 'var(--emerald-400)', fontSize: 14 }}>Self-Drive Discount</span>
                    <span style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>-{Math.round(SELF_DRIVE_DISCOUNT * 100)}%</span>
                 </div>
               )}
               <div className="flex-between">
                  <span style={{ color: 'var(--slate-400)', fontSize: 14 }}>Service Fee</span>
                  <span style={{ fontSize: 14 }}>Included</span>
               </div>
               <div style={{ borderTop: '1px solid var(--slate-800)', paddingTop: 16, marginTop: 16 }} className="flex-between">
                  <span style={{ fontWeight: 800 }}>Total Estimate</span>
                  <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--brand-gold)' }}>
                    {selectedVehicle ? formatPHP(computeQuote(selectedVehicle)) : '—'}
                  </span>
               </div>
            </div>
          </div>

          <div style={{ background: 'var(--brand-gold-light)', padding: 24, borderRadius: 'var(--radius-xl)', border: '1px solid var(--brand-gold)' }}>
             <h4 style={{ color: 'var(--brand-gold-dark)', fontSize: 14, marginBottom: 12, fontWeight: 800 }}>IMPORTANT NOTES:</h4>
             <ul style={{ paddingLeft: 16, fontSize: 13, color: 'var(--brand-gold-dark)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {formData.serviceType === 'withDriver' ? (
                  <>
                    <li>Dispatch will confirm driver availability for your route.</li>
                    <li>The vehicle will be ready 15 mins before pickup.</li>
                  </>
                ) : (
                  <>
                    <li>A valid professional driver's license is required.</li>
                    <li>Security deposit of ₱5,000 required at pickup.</li>
                  </>
                )}
                <li>Estimated cost subject to final route verification.</li>
             </ul>
          </div>
        </div>
      </div>

      {/* Success Modal — portaled to body so fixed backdrop covers full viewport (transform on page root breaks position:fixed) */}
      {showConfirmation && (
        <Portal>
          <div className="modal-backdrop">
            <div className="modal animate-in zoom-in duration-300" style={{ textAlign: 'center', maxWidth: 460, padding: 48 }}>
              <div style={{ width: 80, height: 80, background: 'var(--emerald-50)', color: 'var(--emerald-500)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                 <CheckCircle2 size={40} />
              </div>
              <h2 style={{ fontSize: 28, marginBottom: 12, fontWeight: 800 }}>Reservation Sent!</h2>
              <p style={{ fontSize: 15, color: 'var(--slate-500)', marginBottom: 32, lineHeight: 1.6 }}>
                  Your request <span style={{ fontWeight: 800, color: 'var(--slate-900)' }}>{orderSummary.id}</span> has been successfully sent to our dispatch team.
              </p>
              <div style={{ background: 'var(--slate-50)', padding: 24, borderRadius: 'var(--radius-lg)', marginBottom: 32 }}>
                  <div className="flex-between">
                      <span style={{ fontSize: 13, color: 'var(--slate-400)', fontWeight: 700 }}>ESTIMATED TOTAL</span>
                      <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--slate-900)' }}>{formatPHP(orderSummary.cost)}</span>
                  </div>
              </div>
              <div className="reservation-success-actions">
                <button
                    onClick={() => navigate('/customer')}
                    className="btn btn-outline w-full"
                    style={{ height: 56, fontSize: 15 }}
                >
                    Return to Dashboard
                </button>
                <button
                    onClick={() => navigate('/customer/reservations')}
                    className="btn btn-brand w-full"
                    style={{ height: 56, fontSize: 15, fontWeight: 800 }}
                >
                    View My Trips
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}