import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import { Customers } from './components/Customers';
import { Vehicles } from './components/Vehicles';
import { Reservations } from './components/Reservations';
import { Drivers } from './components/Drivers';
import { Employees } from './components/Employees';
import { Settings } from './components/Settings';
import { Billing } from './components/Billing';
import { Dispatch } from './components/Dispatch';
import { Tracking } from './components/Tracking';
import { Cancellations } from './components/Cancellations';
import { Contracts } from './components/Contracts';
import { SupportTickets } from './components/SupportTickets';
import { Payroll } from './components/Payroll';
import { Members } from './components/Members';
import { Loans } from './components/Loans';
import { Maintenance } from './components/Maintenance';
import { Login } from './components/Login';
import { ForgotPassword } from './components/ForgotPassword';
import { ResetPassword } from './components/ResetPassword';
import { NotificationBell } from './components/NotificationBell';
import { Toaster } from 'sonner';
import { Menu } from 'lucide-react';
import { supabase } from './lib/supabase';

function getUnauthenticatedView(): 'login' | 'forgot-password' | 'reset-password' {
  const p = (window.location.pathname || '/').replace(/\/$/, '') || '/';
  if (p === '/forgot-password') return 'forgot-password';
  if (p === '/reset-password') return 'reset-password';
  return 'login';
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      setIsAuthenticated(!!session);
      setIsCheckingAuth(false);
    };

    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setIsAuthenticated(!!session);
    });
    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setActiveScreen('dashboard');
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard': return <Dashboard onNavigate={setActiveScreen} />;
      case 'customers': return <Customers />;
      case 'vehicles': return <Vehicles />;
      case 'reservations': return <Reservations />;
      case 'drivers': return <Drivers />;
      case 'employees': return <Employees />;
      case 'settings': return <Settings />;
      case 'billing': return <Billing />;
      case 'dispatch': return <Dispatch />;
      case 'tracking': return <Tracking />;
      case 'cancellations': return <Cancellations />;
      case 'contracts': return <Contracts />;
      case 'support': return <SupportTickets />;
      case 'payroll': return <Payroll />;
      case 'members': return <Members />;
      case 'loans': return <Loans />;
      case 'maintenance': return <Maintenance />;
      default: return (
        <div className="empty-state" style={{ marginTop: 80 }}>
          <div className="empty-state-icon">🚧</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, textTransform: 'capitalize' }}>{activeScreen} Section</h2>
          <p>This module is currently being built.</p>
        </div>
      );
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Initializing</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    const unauthView = getUnauthenticatedView();
    return (
      <>
        {unauthView === 'login' && <Login onLogin={() => setIsAuthenticated(true)} />}
        {unauthView === 'forgot-password' && <ForgotPassword />}
        {unauthView === 'reset-password' && <ResetPassword />}
        <Toaster position="bottom-right" richColors />
      </>
    );
  }

  const goToScreen = (id: string) => {
    setActiveScreen(id);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="app-layout">
      <Sidebar
        activeScreen={activeScreen}
        onNavigate={goToScreen}
        onLogout={handleLogout}
        mobileOpen={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />
      <main className="main-content">
        <div
          className="admin-top-bar"
          style={{
            position: 'sticky', top: 0, zIndex: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '12px max(16px, env(safe-area-inset-right)) 12px max(16px, env(safe-area-inset-left))',
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid var(--slate-100)',
          }}
        >
          <button
            type="button"
            className="admin-mobile-menu-btn"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu size={22} strokeWidth={2.25} />
          </button>
          <div style={{ flex: 1 }} />
          <NotificationBell onNavigate={setActiveScreen} />
        </div>
        <div className="page-container" key={activeScreen}>
          {renderScreen()}
        </div>
      </main>
      <Toaster position="top-center" richColors />
    </div>
  );
}
