import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import { Home, LogOut, User, Calendar, CreditCard, MapPin, Zap, Loader2, Wallet, AlertTriangle } from 'lucide-react';
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
        <div className="nav-content">
          <div className="flex-start" onClick={() => navigate('/customer')} style={{ cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/sttc_logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ lineHeight: 1 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--slate-900)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SAFE TRAVEL</h2>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--brand-gold-dark)', letterSpacing: '0.1em' }}>COOPERATIVE</p>
            </div>
          </div>

          <div className="flex-start" style={{ gap: 4 }}>
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
                  fontWeight: isActive(item.path) ? 800 : 600
                }}
              >
                <item.icon size={16} />
                <span style={{ fontSize: 13 }}>{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex-start" style={{ gap: 12 }}>
             <NotificationBell />
             <button
              onClick={handleLogout}
              className="btn btn-outline btn-sm"
              style={{ padding: '8px 16px', borderRadius: 'var(--radius-md)', background: 'var(--slate-50)', border: 'none' }}
             >
                <LogOut size={16} />
                <span>Sign Out</span>
             </button>
          </div>
        </div>
      </nav>

      <main style={{ flex: 1, padding: '40px 32px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
        <Outlet />
      </main>
      
      <footer style={{ padding: '40px 32px', borderTop: '1px solid var(--slate-100)', textAlign: 'center', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
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