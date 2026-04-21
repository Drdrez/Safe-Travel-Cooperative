import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  ShieldCheck,
  Clock,
  MapPin,
  Users,
  Wallet,
  HandCoins,
  Car,
  CarFront,
  Caravan,
  Truck,
  Bus,
  BusFront,
  PhoneCall,
  Mail,
  ChevronRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { COOP_CONTACT } from '../../lib/contactInfo';
import { formatPHP, fromCents } from '../../lib/utils';
import { useOpPrefs } from '../../lib/useOpPrefs';

type FleetVehicle = {
  id: string;
  model: string;
  plate_number: string;
  capacity: number | null;
  daily_rate_cents: number | null;
  image_url?: string | null;
  status?: string | null;
};

type SampleVehicle = {
  id: string;
  name: string;
  category: 'Sedan' | 'SUV' | 'Van' | 'Shuttle';
  capacity: number;
  dailyRatePHP: number;
  tint: string;
  icon: typeof Car;
};

const SAMPLE_VEHICLES: SampleVehicle[] = [
  { id: 's1', name: 'Toyota Vios',      category: 'Sedan',   capacity: 4,  dailyRatePHP: 2800, tint: '#eab308', icon: Car   },
  { id: 's2', name: 'Honda City',       category: 'Sedan',   capacity: 4,  dailyRatePHP: 2900, tint: '#3b82f6', icon: Car   },
  { id: 's3', name: 'Toyota Innova',    category: 'SUV',     capacity: 7,  dailyRatePHP: 3500, tint: '#10b981', icon: Car   },
  { id: 's4', name: 'Mitsubishi Xpander', category: 'SUV',   capacity: 7,  dailyRatePHP: 3200, tint: '#ef4444', icon: Car   },
  { id: 's5', name: 'Toyota Hiace',     category: 'Van',     capacity: 12, dailyRatePHP: 5000, tint: '#8b5cf6', icon: Truck },
  { id: 's6', name: 'Nissan Urvan',     category: 'Van',     capacity: 15, dailyRatePHP: 5500, tint: '#0ea5e9', icon: Truck },
  { id: 's7', name: 'Hyundai H350',     category: 'Shuttle', capacity: 18, dailyRatePHP: 7000, tint: '#f97316', icon: Bus   },
  { id: 's8', name: 'Foton Traveller',  category: 'Shuttle', capacity: 20, dailyRatePHP: 7800, tint: '#14b8a6', icon: Bus   },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Trusted drivers',
    body: 'Every driver is checked, licensed, and trained before they take a trip.',
  },
  {
    icon: Clock,
    title: 'Always on call',
    body: 'Our team answers your questions and handles bookings any time of the day.',
  },
  {
    icon: MapPin,
    title: 'See your trip live',
    body: 'Watch your ride on a map and share the link with family so they know you are safe.',
  },
  {
    icon: Wallet,
    title: 'Clear prices',
    body: 'No hidden fees. You see the price before you book and get a receipt after you pay.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Make an account',
    body: 'Sign up in a few minutes. It is free to register.',
  },
  {
    n: '02',
    title: 'Book your ride',
    body: 'Choose where you are going, the date, and the vehicle you want. See the price right away.',
  },
  {
    n: '03',
    title: 'Travel safely',
    body: 'Pay online, track your trip, and get an official receipt when the ride is done.',
  },
];

const VEHICLE_TYPES = [
  { icon: CarFront, label: 'Sedan', sub: 'Up to 4 seats' },
  { icon: Car, label: 'SUV', sub: 'Up to 7 seats' },
  { icon: Caravan, label: 'Van', sub: 'Up to 12 seats' },
  { icon: BusFront, label: 'Coaster', sub: 'Up to 22 seats' },
  { icon: Bus, label: 'Bus', sub: '40+ seats' },
] as const;

export default function Landing() {
  const [fleet, setFleet] = useState<FleetVehicle[]>([]);
  const [loadingFleet, setLoadingFleet] = useState(true);
  const [counts, setCounts] = useState<{ vehicles: number; drivers: number; trips: number }>({
    vehicles: 0,
    drivers: 0,
    trips: 0,
  });
  const { prefs } = useOpPrefs();

  useEffect(() => {
    (async () => {
      try {
        const [{ data: vehicles }, { count: driverCount }, { count: tripCount }] = await Promise.all([
          supabase
            .from('vehicles')
            .select('id, model, plate_number, capacity, daily_rate_cents, image_url, status')
            .neq('status', 'Retired')
            .order('model', { ascending: true })
            .limit(80),
          supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .in('role', ['driver', 'dispatcher']),
          supabase
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Completed'),
        ]);

        setFleet((vehicles as FleetVehicle[]) || []);
        const { count: vehicleCount } = await supabase
          .from('vehicles')
          .select('id', { count: 'exact', head: true });
        setCounts({
          vehicles: vehicleCount || 0,
          drivers: driverCount || 0,
          trips: tripCount || 0,
        });
      } catch {
      } finally {
        setLoadingFleet(false);
      }
    })();
  }, []);

  return (
    <div className="landing-page" style={{ background: '#fff', color: 'var(--slate-900)' }}>
      {prefs.maintenance_mode && (
        <div
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '10px 16px',
            background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
            color: '#3f2b00',
            fontSize: 13,
            fontWeight: 700,
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={16} />
          <span>
            We're doing scheduled maintenance. Bookings and payments may be briefly unavailable.
          </span>
        </div>
      )}
      <header
        className="landing-site-header"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--slate-100)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src="/sttc_logo.png"
              alt="Safe Travel Transport Cooperative"
              style={{ width: 40, height: 40, objectFit: 'contain' }}
            />
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '-0.02em' }}>
              Safe Travel <span style={{ color: 'var(--brand-gold-dark)' }}>Cooperative</span>
            </span>
          </Link>
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--slate-600)',
            }}
          >
            <a href="#why" className="hide-sm">Why us</a>
            <a href="#vehicles" className="hide-sm">Vehicles</a>
            <a href="#how" className="hide-sm">How it works</a>
            <a href="#membership" className="hide-sm">Membership</a>
            <Link to="/login" className="btn btn-outline btn-sm">Sign in</Link>
            <Link to="/register" className="btn btn-brand btn-sm" style={{ whiteSpace: 'nowrap' }}>
              Sign up <ArrowRight size={14} />
            </Link>
          </nav>
        </div>
      </header>

      <section
        className="landing-hero"
        style={{
          position: 'relative',
          padding: '120px 24px 132px',
          overflow: 'hidden',
          color: 'white',
          backgroundImage:
            'linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.55) 45%, rgba(15,23,42,0.85) 100%), url("https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=2000&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          style={{
            maxWidth: 880,
            margin: '0 auto',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <h1
            style={{
              color: 'white',
              fontSize: 'clamp(2.4rem, 5vw, 4rem)',
              lineHeight: 1.05,
              marginBottom: 20,
              letterSpacing: '-0.035em',
            }}
          >
            Safe rides,
            <br />
            <span
              style={{
                background: 'linear-gradient(120deg, #facc15, var(--brand-gold))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              for every trip.
            </span>
          </h1>
          <p
            style={{
              fontSize: 17,
              lineHeight: 1.6,
              color: 'rgba(255,255,255,0.85)',
              maxWidth: 620,
              margin: '0 auto 32px',
            }}
          >
            Book a ride with trusted drivers and well-kept vehicles. See the price before you book,
            track your trip on a map, and get a receipt when you pay.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 40,
              justifyContent: 'center',
            }}
          >
            <Link
              to="/register"
              className="btn btn-brand"
              style={{ height: 52, padding: '0 26px', fontSize: 15 }}
            >
              Sign up free <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="btn btn-outline"
              style={{
                height: 52,
                padding: '0 26px',
                fontSize: 15,
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                borderColor: 'rgba(255,255,255,0.25)',
                backdropFilter: 'blur(6px)',
              }}
            >
              I already have an account
            </Link>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 36,
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Stat label="Vehicles ready" value={counts.vehicles || '—'} onDark />
            <Stat label="Drivers on the road" value={counts.drivers || '—'} onDark />
            <Stat label="Trips finished" value={counts.trips || '—'} onDark />
          </div>
        </div>
      </section>

      <section id="why" style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <SectionHeader
            eyebrow="Why Safe Travel"
            title="A simple, safe way to book a ride"
            subtitle="We make travel easy so you can focus on where you are going, not how you will get there."
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 20,
              marginTop: 48,
            }}
          >
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                style={{
                  padding: 28,
                  background: '#fff',
                  border: '1px solid var(--slate-100)',
                  borderRadius: 18,
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'var(--brand-gold-light)',
                    color: 'var(--brand-gold-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20,
                  }}
                >
                  <Icon size={22} />
                </div>
                <h3 style={{ fontSize: 17, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'var(--slate-600)', lineHeight: 1.55 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="vehicles" style={{ padding: '80px 0', background: 'var(--slate-50)', overflow: 'hidden' }}>
        <div style={{ padding: '0 24px' }}>
          <SectionHeader
            eyebrow="Our vehicles"
            title="A vehicle for every trip"
            subtitle="Fleet units you see here are the same ones we manage in our system (except vehicles marked Retired). Rates and availability can change—sign in to book."
          />
        </div>

        <div style={{ marginTop: 48 }}>
          {loadingFleet ? (
            <div
              style={{
                padding: 40,
                display: 'flex',
                justifyContent: 'center',
                color: 'var(--slate-400)',
              }}
            >
              <Loader2 className="animate-spin" />
            </div>
          ) : (
            <VehicleMarquee realVehicles={fleet} />
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, padding: '0 24px' }}>
          <Link
            to="/login"
            className="btn btn-brand"
            style={{ height: 48, padding: '0 24px', fontSize: 14 }}
          >
            See all vehicles <ChevronRight size={16} />
          </Link>
        </div>
      </section>

      <section id="how" style={{ padding: '80px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHeader
            eyebrow="How it works"
            title="Book a ride in three simple steps"
          />
          <div
            style={{
              marginTop: 48,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
            }}
          >
            {STEPS.map((s) => (
              <div
                key={s.n}
                style={{
                  position: 'relative',
                  padding: 32,
                  borderRadius: 20,
                  border: '1px solid var(--slate-100)',
                  background: '#fff',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: -18,
                    left: 24,
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, var(--brand-gold) 0%, #facc15 100%)',
                    color: 'var(--slate-900)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 14,
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  {s.n}
                </span>
                <h3 style={{ fontSize: 18, marginTop: 18, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: 'var(--slate-600)', lineHeight: 1.6 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="membership"
        style={{
          padding: '80px 24px',
          background:
            'linear-gradient(135deg, var(--slate-900) 0%, #1e293b 70%, var(--brand-gold-dark) 140%)',
          color: 'white',
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
          }}
          className="landing-membership-grid"
        >
          <div>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                background: 'rgba(234,179,8,0.15)',
                color: 'var(--brand-gold)',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 20,
              }}
            >
              <HandCoins size={12} /> Membership
            </span>
            <h2 style={{ color: 'white', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', marginBottom: 16 }}>
              Join as a member, grow with us.
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
              Members save money, can apply for loans, and help decide where the group goes next.
              You can sign up to be a member right from your account.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link to="/register" className="btn btn-brand" style={{ height: 48, padding: '0 22px' }}>
                Join as a member <ArrowRight size={16} />
              </Link>
              <a
                href="#why"
                className="btn btn-outline"
                style={{
                  height: 48,
                  padding: '0 22px',
                  background: 'transparent',
                  color: 'white',
                  borderColor: 'rgba(255,255,255,0.2)',
                }}
              >
                Learn more
              </a>
            </div>
          </div>

          <div
            style={{
              padding: 28,
              borderRadius: 20,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <MemberPerk
              icon={Wallet}
              title="Savings that grow"
              body="Put a little aside each month. Your savings earn a share of our yearly profits."
            />
            <MemberPerk
              icon={HandCoins}
              title="Easy loans"
              body="Ask for a loan when you need one, with fair rates and clear monthly payments."
            />
            <MemberPerk
              icon={Users}
              title="A voice that counts"
              body="Vote at our yearly meeting and help pick the people who run the group."
              last
            />
          </div>
        </div>
      </section>

      <section style={{ padding: '72px 24px', background: '#fff' }}>
        <div
          style={{
            maxWidth: 960,
            margin: '0 auto',
            padding: '44px 32px',
            borderRadius: 24,
            background: 'linear-gradient(135deg, var(--brand-gold-light) 0%, #fef9c3 100%)',
            border: '1px solid #fde68a',
            textAlign: 'center',
          }}
        >
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', marginBottom: 12 }}>
            Ready for your next trip?
          </h2>
          <p style={{ color: 'var(--slate-700)', fontSize: 15, marginBottom: 24 }}>
            Sign up, book a ride, or log in to keep going where you left off.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            <Link
              to="/register"
              className="btn btn-brand"
              style={{ height: 52, padding: '0 28px', fontSize: 15 }}
            >
              Sign up now <ArrowRight size={16} />
            </Link>
            <Link
              to="/login"
              className="btn btn-outline"
              style={{ height: 52, padding: '0 28px', fontSize: 15 }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer
        style={{
          padding: '48px 24px 32px',
          background: 'var(--slate-900)',
          color: 'rgba(255,255,255,0.72)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 32,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <img
                src="/sttc_logo.png"
                alt="STTC"
                style={{ width: 40, height: 40, objectFit: 'contain', background: 'white', borderRadius: 10, padding: 4 }}
              />
              <strong style={{ color: 'white', fontSize: 15 }}>Safe Travel Cooperative</strong>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6 }}>
              Safe rides, trusted drivers, and fair prices. We take you where you need to go.
            </p>
          </div>
          <div>
            <h5 style={{ color: 'white', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Explore
            </h5>
            <ul style={{ display: 'grid', gap: 8, fontSize: 13, listStyle: 'none' }}>
              <li><a href="#why">Why Safe Travel</a></li>
              <li><a href="#vehicles">Our vehicles</a></li>
              <li><a href="#how">How it works</a></li>
              <li><a href="#membership">Membership</a></li>
            </ul>
          </div>
          <div>
            <h5 style={{ color: 'white', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Account
            </h5>
            <ul style={{ display: 'grid', gap: 8, fontSize: 13, listStyle: 'none' }}>
              <li><Link to="/login">Sign in</Link></li>
              <li><Link to="/register">Register</Link></li>
            </ul>
          </div>
          <div>
            <h5 style={{ color: 'white', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              Contact
            </h5>
            <ul style={{ display: 'grid', gap: 10, fontSize: 13, listStyle: 'none' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mail size={14} />{' '}
                <a href={`mailto:${COOP_CONTACT.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {COOP_CONTACT.email}
                </a>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexDirection: 'column' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <PhoneCall size={14} />
                  <a href={`tel:${COOP_CONTACT.phoneE164}`} style={{ color: 'inherit', fontWeight: 700, textDecoration: 'none' }}>
                    {COOP_CONTACT.phoneDisplay}
                  </a>
                </span>
                <span style={{ fontSize: 12, opacity: 0.85, paddingLeft: 22 }}>Open 24 hours, every day</span>
              </li>
            </ul>
          </div>
        </div>
        <div
          style={{
            maxWidth: 1200,
            margin: '32px auto 0',
            padding: '16px 0 0',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <span>© {new Date().getFullYear()} Safe Travel Transport Cooperative. All rights reserved.</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/terms" style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>
              Terms of service
            </Link>
            <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 600 }}>
              Privacy policy
            </Link>
            <span>Made with care by the cooperative community.</span>
          </span>
        </div>
      </footer>

      <style>{`
        .landing-page a:hover { color: var(--brand-gold-dark); }
        .landing-page footer a:hover { color: var(--brand-gold); }

        .landing-vehicle-strip {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
        }
        .landing-vehicle-card {
          text-align: center;
          padding: 20px 10px 18px;
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(6px);
          transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;
        }
        .landing-vehicle-card:hover {
          transform: translateY(-4px);
          border-color: rgba(245, 200, 66, 0.45);
          background: linear-gradient(180deg, rgba(245,200,66,0.10) 0%, rgba(255,255,255,0.02) 100%);
        }
        .landing-vehicle-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          margin-bottom: 12px;
          background: radial-gradient(circle at 50% 30%, rgba(245,200,66,0.18), rgba(245,200,66,0.04) 70%);
          border: 1px solid rgba(245,200,66,0.28);
          color: #facc15;
        }
        @media (max-width: 860px) {
          .landing-site-header {
            display: none !important;
          }
          .landing-hero {
            padding-top: 72px !important;
          }
          .landing-hero-grid { grid-template-columns: 1fr !important; }
          .hide-sm { display: none !important; }
          .landing-vehicle-strip { grid-template-columns: repeat(3, 1fr); }
          .landing-vehicle-card:nth-child(n+4) { display: none; }
        }
        @media (max-width: 520px) {
          .landing-vehicle-strip { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          .landing-vehicle-card:nth-child(n+3) { display: none; }
          .landing-vehicle-icon { width: 60px; height: 60px; }
        }
      `}</style>
    </div>
  );
}

function Stat({
  label,
  value,
  onDark,
}: {
  label: string;
  value: number | string;
  onDark?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: onDark ? 'white' : 'var(--slate-900)',
          letterSpacing: '-0.02em',
        }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: onDark ? 'rgba(255,255,255,0.65)' : 'var(--slate-500)',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto' }}>
      <span
        style={{
          display: 'inline-block',
          fontSize: 12,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--brand-gold-dark)',
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </span>
      <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', marginBottom: subtitle ? 12 : 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ color: 'var(--slate-600)', fontSize: 15, lineHeight: 1.6 }}>{subtitle}</p>
      )}
    </div>
  );
}

type MarqueeCard = {
  key: string;
  title: string;
  subtitle: string;
  priceLabel: string;
  tint: string;
  icon: typeof Car;
  imageUrl?: string | null;
  statusBadge?: string;
};

function VehicleMarquee({ realVehicles }: { realVehicles: FleetVehicle[] }) {
  const source: MarqueeCard[] =
    realVehicles.length > 0
      ? realVehicles.map((v) => ({
          key: v.id,
          title: v.model || 'Vehicle',
          subtitle: `${v.plate_number || '—'}${v.capacity != null ? ` • ${v.capacity} seats` : ''}`,
          priceLabel: v.daily_rate_cents
            ? `${formatPHP(fromCents(v.daily_rate_cents))} / day`
            : 'Rate on request',
          tint: 'var(--brand-gold)',
          icon: Car,
          imageUrl: v.image_url ?? null,
          statusBadge: v.status || 'Available',
        }))
      : SAMPLE_VEHICLES.map((s) => ({
          key: s.id,
          title: s.name,
          subtitle: `${s.category} • ${s.capacity} seats`,
          priceLabel: `₱${s.dailyRatePHP.toLocaleString()} / day`,
          tint: s.tint,
          icon: s.icon,
          statusBadge: 'Available',
        }));

  const loop = [...source, ...source];

  return (
    <div className="vehicle-marquee" aria-label="Our vehicles carousel">
      <div className="vehicle-marquee-track">
        {loop.map((item, idx) => (
          <MarqueeCard key={`${item.key}-${idx}`} card={item} />
        ))}
      </div>

      <style>{`
        .vehicle-marquee {
          position: relative;
          overflow: hidden;
          padding: 8px 0;
          -webkit-mask-image: linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0, #000 6%, #000 94%, transparent 100%);
        }
        .vehicle-marquee-track {
          display: flex;
          gap: 20px;
          width: max-content;
          animation: vehicle-marquee-scroll 50s linear infinite;
        }
        .vehicle-marquee:hover .vehicle-marquee-track,
        .vehicle-marquee:focus-within .vehicle-marquee-track {
          animation-play-state: paused;
        }
        @keyframes vehicle-marquee-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vehicle-marquee-track { animation: none; }
          .vehicle-marquee { overflow-x: auto; }
        }
      `}</style>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const s = status || 'Available';
  const palette =
    s === 'Available'
      ? { background: 'var(--emerald-50)', color: 'var(--emerald-600)' }
      : s === 'Maintenance'
        ? { background: 'var(--amber-50)', color: 'var(--amber-700)' }
        : s === 'Reserved' || s === 'In Service'
          ? { background: 'var(--sky-50)', color: 'var(--sky-700)' }
          : { background: 'var(--slate-100)', color: 'var(--slate-600)' };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        padding: '4px 10px',
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        whiteSpace: 'nowrap',
        ...palette,
      }}
    >
      {s}
    </span>
  );
}

function MarqueeCard({ card }: { card: MarqueeCard }) {
  const Icon = card.icon;
  return (
    <div
      style={{
        flex: '0 0 auto',
        width: 'min(280px, 85vw)',
        maxWidth: '100%',
        background: '#fff',
        borderRadius: 18,
        border: '1px solid var(--slate-100)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.25s, box-shadow 0.25s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      <div
        style={{
          height: 150,
          position: 'relative',
          background: card.imageUrl
            ? `url(${card.imageUrl}) center/cover`
            : `linear-gradient(135deg, ${card.tint}22 0%, ${card.tint}55 100%)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!card.imageUrl && (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(240px 120px at 50% 110%, rgba(255,255,255,0.55) 0%, transparent 60%)',
              }}
            />
            <Icon size={72} strokeWidth={1.4} style={{ color: card.tint, position: 'relative' }} />
          </>
        )}
      </div>
      <div style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h4
              style={{
                fontSize: 16,
                marginBottom: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {card.title}
            </h4>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--slate-500)' }}>
              {card.subtitle}
            </div>
          </div>
          <StatusPill status={card.statusBadge || 'Available'} />
        </div>
        <div style={{ marginTop: 14, fontSize: 15, fontWeight: 800, color: 'var(--slate-900)' }}>
          {card.priceLabel}
        </div>
      </div>
    </div>
  );
}

function MemberPerk({
  icon: Icon,
  title,
  body,
  last,
}: {
  icon: typeof Wallet;
  title: string;
  body: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        padding: '14px 4px',
        borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(234,179,8,0.15)',
          color: 'var(--brand-gold)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={18} />
      </div>
      <div>
        <div style={{ color: 'white', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 1.6 }}>{body}</div>
      </div>
    </div>
  );
}
