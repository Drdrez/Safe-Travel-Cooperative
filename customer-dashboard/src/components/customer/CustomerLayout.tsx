import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import {
  Home,
  LogOut,
  User,
  Calendar,
  CreditCard,
  MapPin,
  Zap,
  Loader2,
  Wallet,
  AlertTriangle,
  Menu,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { NotificationBell } from '../NotificationBell';
import { useOpPrefs } from '../../lib/useOpPrefs';

export default function CustomerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const { prefs } = useOpPrefs();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 1100) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const verify = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (isMounted) navigate('/login', { replace: true });
        return;
      }

      const { data: portalLocked, error: rpcError } = await supabase.rpc('is_customer_portal_locked');
      if (!rpcError && portalLocked === true) {
        await supabase.auth.signOut();
        if (isMounted) {
          localStorage.removeItem('customerLoggedIn');
          localStorage.removeItem('customerName');
          localStorage.removeItem('customerEmail');
          toast.error(
            'This account has been deactivated. Contact the cooperative if you need access again.'
          );
          navigate('/login', { replace: true });
        }
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, deactivated_at')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        await supabase.auth.signOut();
        if (isMounted) {
          toast.error(`Session could not be verified (${profileError.message}). Please sign in again.`);
          navigate('/login', { replace: true });
        }
        return;
      }

      const deactivated =
        profile?.deactivated_at != null && String(profile.deactivated_at).trim() !== '';
      if (deactivated) {
        await supabase.auth.signOut();
        if (isMounted) {
          localStorage.removeItem('customerLoggedIn');
          localStorage.removeItem('customerName');
          localStorage.removeItem('customerEmail');
          toast.error(
            'This account has been deactivated. Contact the cooperative if you need access again.'
          );
          navigate('/login', { replace: true });
        }
        return;
      }

      if (profile?.role && profile.role !== 'customer') {
        await supabase.auth.signOut();
        if (isMounted) {
          toast.error('This portal is for customers only.');
          navigate('/login', { replace: true });
        }
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        if (isMounted) {
          toast.error('No customer profile found for this account.');
          navigate('/login', { replace: true });
        }
        return;
      }

      if (isMounted) {
        setIsAuthorized(true);
        setIsChecking(false);
      }
    };

    verify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && isMounted) {
        navigate('/login', { replace: true });
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && isMounted) {
        verify();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogout = async () => {
    toast.info('Signing out...');
    await supabase.auth.signOut();
    localStorage.removeItem('customerLoggedIn');
    localStorage.removeItem('customerName');
    localStorage.removeItem('customerEmail');
    toast.success('Signed out successfully');
    navigate('/', { replace: true });
  };

  if (isChecking || !isAuthorized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12, color: 'var(--slate-500)' }}>
        <Loader2 size={20} className="animate-spin" />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Verifying session...</span>
      </div>
    );
  }

  const navItems = [
    { path: '/customer', label: 'Home', icon: Home },
    { path: '/customer/make-reservation', label: 'New Booking', icon: Calendar },
    { path: '/customer/reservations', label: 'My Trips', icon: MapPin },
    { path: '/customer/billing', label: 'Payments', icon: CreditCard },
    { path: '/customer/tracking', label: 'Track Trip', icon: Zap },
    { path: '/customer/membership', label: 'Membership', icon: Wallet },
    { path: '/customer/profile', label: 'Account', icon: User },
  ];

  const isActive = (path: string) => {
    if (path === '/customer') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="customer-layout">
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
            The cooperative is currently performing maintenance. Some features may be temporarily
            unavailable.
          </span>
        </div>
      )}
      {/* Premium Top Navigation */}
      <nav className="top-nav">
        <div className="nav-content customer-nav-row">
          <div className="flex-start customer-nav-brand" onClick={() => navigate('/customer')} style={{ cursor: 'pointer', minWidth: 0 }}>
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <img src="/sttc_logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ lineHeight: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SAFE TRAVEL</h2>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-gold-dark)', letterSpacing: '0.1em' }}>COOPERATIVE</p>
            </div>
          </div>

          <div className="customer-nav-links">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn('btn btn-sm', isActive(item.path) ? 'btn-brand' : 'btn-ghost')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  color: isActive(item.path) ? 'var(--slate-900)' : 'var(--slate-500)',
                  background: isActive(item.path) ? 'var(--brand-gold)' : 'transparent',
                  fontWeight: isActive(item.path) ? 800 : 600,
                }}
              >
                <item.icon size={16} />
                <span style={{ fontSize: 13 }}>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex-start customer-nav-tools" style={{ gap: 12 }}>
            <NotificationBell />
            <button
              type="button"
              onClick={handleLogout}
              className="btn btn-outline btn-sm customer-signout-btn"
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'var(--slate-50)', border: 'none' }}
            >
              <LogOut size={16} />
              <span className="customer-signout-text">Sign Out</span>
            </button>
            <button
              type="button"
              className="customer-menu-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </nav>

      {mobileNavOpen && (
        <>
          <div
            className="customer-mobile-backdrop"
            role="presentation"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden
          />
          <div className="customer-mobile-drawer">
            <div className="customer-mobile-drawer-header">
              <span style={{ fontWeight: 800, fontSize: 15 }}>Menu</span>
              <button
                type="button"
                className="customer-mobile-drawer-close"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
              >
                <X size={22} />
              </button>
            </div>
            <nav className="customer-mobile-drawer-nav">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn('customer-mobile-nav-link', isActive(item.path) && 'active')}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <item.icon size={20} />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </>
      )}

      <main className="customer-main-inner">
        <Outlet />
      </main>
      
      <footer className="customer-footer-inner">
        <p style={{ fontSize: 13, color: 'var(--slate-400)', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span>&copy; {new Date().getFullYear()} Safe Travel & Transport Cooperative. All rights reserved.</span>
          <Link to="/terms" style={{ color: 'var(--brand-gold-dark)', fontWeight: 600 }}>
            Terms of service
          </Link>
          <Link to="/privacy" style={{ color: 'var(--brand-gold-dark)', fontWeight: 600 }}>
            Privacy policy
          </Link>
        </p>
      </footer>
    </div>
  );
}