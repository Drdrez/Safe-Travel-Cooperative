import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Car, UserCircle, Calendar, FileText,
  CreditCard, Navigation, MapPin, XCircle, Settings,
  LogOut, X, KeyRound, ChevronDown, User, Loader2, MessageSquare,
  Wallet, Wrench, HandCoins, BadgeDollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Portal } from './ui/Portal';

const menuSections: { label: string; items: { id: string; label: string; icon: any }[] }[] = [
  {
    label: 'Operations',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'reservations', label: 'Bookings', icon: Calendar },
      { id: 'contracts', label: 'Contracts', icon: FileText },
      { id: 'dispatch', label: 'Dispatch', icon: Navigation },
      { id: 'tracking', label: 'Live Map', icon: MapPin },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'billing', label: 'Billing', icon: CreditCard },
      { id: 'cancellations', label: 'Refunds', icon: XCircle },
      { id: 'payroll', label: 'Payroll', icon: BadgeDollarSign },
    ],
  },
  {
    label: 'Cooperative',
    items: [
      { id: 'members', label: 'Members', icon: Wallet },
      { id: 'loans', label: 'Loans', icon: HandCoins },
    ],
  },
  {
    label: 'Fleet & People',
    items: [
      { id: 'vehicles', label: 'Units', icon: Car },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
      { id: 'drivers', label: 'Operators', icon: UserCircle },
      { id: 'employees', label: 'Personnel', icon: Users },
      { id: 'customers', label: 'Customers', icon: Users },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'support', label: 'Support', icon: MessageSquare },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  activeScreen: string;
  onNavigate: (id: string) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
  activeScreen,
  onNavigate,
  onLogout,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [passForm, setPassForm] = useState({ old: '', new: '', confirm: '' });

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onMobileOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileOpenChange]);

  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = '';
      return;
    }
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => {
      if (mq.matches) document.body.style.overflow = 'hidden';
      else {
        document.body.style.overflow = '';
        onMobileOpenChange(false);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => {
      document.body.style.overflow = '';
      mq.removeEventListener('change', apply);
    };
  }, [mobileOpen, onMobileOpenChange]);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, contact_number, photo_url, email, role')
        .eq('id', data.user.id)
        .single();

      setCurrentUser({
        id: data.user.id,
        name: profile?.full_name || data.user.email?.split('@')[0] || 'Admin',
        email: profile?.email || data.user.email || '',
        phone: profile?.contact_number || '',
        photo: profile?.photo_url || '',
        role: profile?.role === 'admin' ? 'Administrator' : (profile?.role || 'User'),
      });
    };
    fetchUser();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setIsSavingProfile(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: currentUser.name,
        contact_number: currentUser.phone,
        photo_url: currentUser.photo || null,
      })
      .eq('id', currentUser.id);
    setIsSavingProfile(false);
    if (error) { toast.error(`Couldn't save profile: ${error.message}`); return; }
    toast.success('Profile updated');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { toast.error('File too large (Max 2MB)'); return; }
      const reader = new FileReader();
      reader.onloadend = () => setCurrentUser({ ...currentUser, photo: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.email) { toast.error('Missing account email'); return; }
    if (!passForm.old) { toast.error('Enter your current password'); return; }
    if (passForm.new.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (passForm.new === passForm.old) {
      toast.error('New password must be different from the current one');
      return;
    }
    if (passForm.new !== passForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setIsSaving(true);

    // Verify the current password by re-authenticating. If it's wrong,
    // signInWithPassword will return an error and we abort before the
    // update. This prevents a hijacked session from silently rotating
    // credentials.
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: currentUser.email,
      password: passForm.old,
    });
    if (verifyErr) {
      toast.error('Current password is incorrect');
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: passForm.new });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated successfully');
      setPassForm({ old: '', new: '', confirm: '' });
    }
    setIsSaving(false);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="admin-sidebar-backdrop"
          onClick={() => onMobileOpenChange(false)}
          role="presentation"
          aria-hidden
        />
      )}
      <div className={cn('sidebar', mobileOpen && 'sidebar--open')}>
        <div className="sidebar-brand">
          <div style={{ 
            width: 44, height: 44, background: 'white', borderRadius: '50%', 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)', flexShrink: 0,
            overflow: 'hidden'
          }}>
            <img 
              src="/sttc_logo.png" 
              alt="STTC Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
            />
          </div>
          <div className="sidebar-brand-text">
            <h1>Safe Travel</h1>
            <p>Cooperative</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuSections.map((section) => (
            <div key={section.label} style={{ marginBottom: 4 }}>
              <div style={{ padding: '12px 16px 6px', fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--slate-400)' }}>
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeScreen === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={cn('nav-item', isActive && 'active')}
                  >
                    <Icon className="nav-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="profile-card" onClick={() => setIsProfileOpen(true)}>
            <div className="profile-avatar" style={{ overflow: 'hidden' }}>
              {currentUser?.photo ? <img src={currentUser.photo} alt="P" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (currentUser?.name?.[0] || 'A')}
            </div>
            <div className="profile-info">
              <div className="profile-name">{currentUser?.name || 'Admin'}</div>
              <div className="profile-role">Administrator</div>
            </div>
            <ChevronDown size={16} style={{ color: 'var(--slate-600)' }} />
          </div>

          <button
            type="button"
            onClick={() => {
              onLogout();
              onMobileOpenChange(false);
            }}
            className="logout-btn"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      {isProfileOpen && (
        <Portal>
          <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsProfileOpen(false); }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <h2>Admin Identity & Security</h2>
                <button className="modal-close" onClick={() => setIsProfileOpen(false)}>
                  <X size={20} />
                </button>
              </div>

              <div className="grid-2" style={{ gap: 48 }}>
                {/* Profile Info Form */}
                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  <div className="flex-start gap-4" style={{ marginBottom: 8 }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 24, color: 'var(--slate-400)', overflow: 'hidden', border: '2px solid white', boxShadow: '0 0 0 2px var(--slate-100)' }}>
                        {currentUser?.photo ? <img src={currentUser.photo} alt="P" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={32} />}
                      </div>
                      <button 
                        type="button"
                        onClick={() => document.getElementById('profile-photo-input')?.click()}
                        style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: '50%', background: 'white', border: '1px solid var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)', cursor: 'pointer' }}
                      >
                        <User size={14} style={{ color: 'var(--slate-600)' }} />
                      </button>
                      <input type="file" id="profile-photo-input" hidden accept="image/*" onChange={handleImageUpload} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800 }}>{currentUser?.name}</h3>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Administrator Account</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input className="form-input" value={currentUser?.name} onChange={e => setCurrentUser({ ...currentUser, name: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <input className="form-input" value={currentUser?.phone} onChange={e => setCurrentUser({ ...currentUser, phone: e.target.value })} placeholder="+63 123 456 7890" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Login Email</label>
                      <div style={{ padding: '12px 16px', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-100)', fontSize: 13, fontWeight: 500, color: 'var(--slate-500)' }}>
                        {currentUser?.email}
                      </div>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary btn-lg w-full" disabled={isSavingProfile}>
                    {isSavingProfile ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Update Profile'}
                  </button>
                </form>

                {/* Security Section */}
                <div className="space-y-8">
                  <div>
                    <div className="flex-start gap-2" style={{ marginBottom: 20 }}>
                      <KeyRound size={16} style={{ color: 'var(--brand-gold)' }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--slate-400)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Security Settings</span>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                      <div className="form-group">
                        <label className="form-label">Current Password</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Your current password"
                          value={passForm.old}
                          onChange={e => setPassForm({ ...passForm, old: e.target.value })}
                          autoComplete="current-password"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">New Password</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Min. 8 characters"
                          value={passForm.new}
                          onChange={e => setPassForm({ ...passForm, new: e.target.value })}
                          autoComplete="new-password"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Verify New Password</label>
                        <input
                          type="password"
                          className="form-input"
                          placeholder="Match password"
                          value={passForm.confirm}
                          onChange={e => setPassForm({ ...passForm, confirm: e.target.value })}
                          required
                        />
                      </div>
                      <button type="submit" className="btn btn-brand btn-lg w-full" disabled={isSaving}>
                        {isSaving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Update Security'}
                      </button>
                    </form>
                  </div>

                  <div style={{ paddingTop: 24, borderTop: '1px solid var(--slate-100)' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onLogout();
                        onMobileOpenChange(false);
                      }}
                      className="btn btn-danger btn-md w-full"
                    >
                      <LogOut size={16} />
                      Log Out of System
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
