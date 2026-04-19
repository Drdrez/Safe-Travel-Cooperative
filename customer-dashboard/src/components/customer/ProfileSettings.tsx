import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { User, Eye, EyeOff, Loader2, BadgeCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export default function ProfileSettings() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    contactNumber: '',
    address: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateConfirm, setDeactivateConfirm] = useState('');
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (profile) {
            setFormData({
                fullName: profile.full_name || '',
                email: profile.email || '',
                contactNumber: profile.contact_number || '',
                address: profile.address || ''
            });
        } else {
            setFormData(prev => ({ ...prev, email: user.email || '' }));
        }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateNewPassword = (pw: string): string | null => {
    if (pw.length < 8) return 'Password must be at least 8 characters long';
    if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
    if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return 'Password must contain at least one special character';
    return null;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Session expired. Please sign in again.');
        return;
      }

      const { error: profileError } = await supabase.from('profiles').update({
        full_name: formData.fullName,
        contact_number: formData.contactNumber,
        address: formData.address,
      }).eq('id', user.id);

      if (profileError) {
        toast.error(profileError.message);
        return;
      }
      localStorage.setItem('customerName', formData.fullName);

      const wantsPasswordChange = !!(
        passwordData.currentPassword || passwordData.newPassword || passwordData.confirmPassword
      );

      if (wantsPasswordChange) {
        if (!passwordData.currentPassword) {
          toast.error('Enter your current password to change it');
          return;
        }
        if (passwordData.newPassword !== passwordData.confirmPassword) {
          toast.error('New passwords do not match');
          return;
        }
        const pwErr = validateNewPassword(passwordData.newPassword);
        if (pwErr) {
          toast.error(pwErr);
          return;
        }

        const { error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email || formData.email,
          password: passwordData.currentPassword,
        });
        if (verifyError) {
          toast.error('Current password is incorrect');
          return;
        }

        const { error: pwError } = await supabase.auth.updateUser({
          password: passwordData.newPassword,
        });
        if (pwError) {
          toast.error(pwError.message);
          return;
        }

        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.success('Profile and password updated successfully!');
      } else {
        toast.success('Your profile has been updated!');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (deactivateConfirm.trim().toUpperCase() !== 'DEACTIVATE') {
      toast.error('Type DEACTIVATE to confirm.');
      return;
    }
    setDeactivating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Session expired.');
        return;
      }
      const { error } = await supabase
        .from('profiles')
        .update({ deactivated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      await supabase.auth.signOut();
      localStorage.removeItem('customerLoggedIn');
      localStorage.removeItem('customerName');
      localStorage.removeItem('customerEmail');
      toast.success('Your account has been deactivated.');
      navigate('/', { replace: true });
    } finally {
      setDeactivating(false);
      setDeactivateOpen(false);
      setDeactivateConfirm('');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="page-header">
        <div>
          <h1>Profile Settings</h1>
          <p>Securely manage your personal information and security settings.</p>
        </div>
      </div>

      <div style={{ maxWidth: 840, margin: '0 auto' }} className="space-y-10">
        {/* Profile Form */}
        <div className="card" style={{ padding: '40px 48px' }}>
           <div style={{ display: 'flex', gap: 32, alignItems: 'center', marginBottom: 40 }}>
              <div style={{ position: 'relative' }}>
                 <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--brand-gold-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--brand-gold)' }}>
                     <User size={44} className="text-brand-gold" />
                 </div>
                 <div style={{ position: 'absolute', bottom: 4, right: 4, width: 26, height: 26, background: 'var(--emerald-500)', borderRadius: '50%', border: '4px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <BadgeCheck size={12} className="text-white" />
                 </div>
              </div>
              <div>
                 <h3 style={{ fontSize: 24, fontWeight: 800 }}>{formData.fullName}</h3>
                 <p style={{ fontSize: 14, color: 'var(--slate-500)', fontWeight: 500 }}>Safe Travel Cooperative Member</p>
              </div>
           </div>

           <form onSubmit={handleSaveProfile} className="space-y-10">
              {/* Section 1: Personal Info */}
              <div className="space-y-6">
                <h4 style={{ fontSize: 16, color: 'var(--slate-900)', borderLeft: '4px solid var(--brand-gold)', paddingLeft: 14 }}>Personal Information</h4>
                <div className="grid-2" style={{ gap: 24 }}>
                   <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Full Name</label>
                      <input 
                          name="fullName" 
                          value={formData.fullName} 
                          onChange={handleChange} 
                          className="form-input"
                          style={{ width: '100%', height: 56, padding: '0 20px', borderRadius: 14, border: '1px solid var(--slate-100)', background: 'var(--slate-50)', fontWeight: 600 }}
                      />
                   </div>
                   <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                      <input 
                          name="email" 
                          value={formData.email} 
                          readOnly 
                          className="form-input"
                          style={{ width: '100%', height: 56, padding: '0 20px', borderRadius: 14, border: '1px solid var(--slate-100)', background: 'var(--slate-100)', color: 'var(--slate-400)', cursor: 'not-allowed', fontWeight: 600 }}
                      />
                   </div>
                </div>

                <div className="grid-2" style={{ gap: 24 }}>
                   <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mobile Number</label>
                      <input 
                          name="contactNumber" 
                          value={formData.contactNumber} 
                          onChange={handleChange} 
                          className="form-input"
                          style={{ width: '100%', height: 56, padding: '0 20px', borderRadius: 14, border: '1px solid var(--slate-100)', background: 'var(--slate-50)', fontWeight: 600 }}
                      />
                   </div>
                   <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verified Address</label>
                      <input 
                          name="address" 
                          value={formData.address} 
                          onChange={handleChange} 
                          className="form-input"
                          style={{ width: '100%', height: 56, padding: '0 20px', borderRadius: 14, border: '1px solid var(--slate-100)', background: 'var(--slate-50)', fontWeight: 600 }}
                      />
                   </div>
                </div>
              </div>

              {/* Section 2: Password Update */}
              <div className="space-y-6 pt-10" style={{ borderTop: '1px solid var(--slate-100)' }}>
                <div className="flex-between">
                   <h4 style={{ fontSize: 16, color: 'var(--slate-900)', borderLeft: '4px solid var(--brand-gold)', paddingLeft: 14 }}>Update Password</h4>
                   <span style={{ fontSize: 12, color: 'var(--slate-400)', fontWeight: 600 }}>Last updated 30 days ago</span>
                </div>
                
                <div className="grid-3" style={{ gap: 24 }}>
                   <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Current Password</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                            type={showPasswords.current ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                            className="form-input"
                            style={{ width: '100%', height: 52, padding: '0 20px', paddingRight: 48, borderRadius: 14, border: '1px solid var(--slate-100)', background: 'var(--slate-50)' }}
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                        >
                            {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                   </div>
                   <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>New Password</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                            type={showPasswords.new ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                            className="form-input"
                            style={{ width: '100%', height: 52, padding: '0 20px', paddingRight: 48, borderRadius: 14, border: '1px solid var(--slate-100)', background: 'var(--slate-50)' }}
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                        >
                            {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                   </div>
                   <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--slate-500)', textTransform: 'uppercase' }}>Confirm New</label>
                      <div style={{ position: 'relative' }}>
                        <input 
                            type={showPasswords.confirm ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={passwordData.confirmPassword}
                            onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                            className="form-input"
                            style={{ width: '100%', height: 52, padding: '0 20px', paddingRight: 48, borderRadius: 14, border: '1px solid var(--slate-100)', background: 'var(--slate-50)' }}
                        />
                        <button 
                            type="button" 
                            onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                            style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                        >
                            {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                   </div>
                </div>
              </div>

              <div style={{ paddingTop: 16 }}>
                 <button type="submit" disabled={isSaving} className="btn btn-brand" style={{ height: 60, padding: '0 48px', fontSize: 16 }}>
                    {isSaving ? <Loader2 className="animate-spin" /> : <>Save All Changes <BadgeCheck size={22} /></>}
                 </button>
              </div>
           </form>
        </div>

        <div
          className="card"
          style={{
            padding: '32px 48px',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            background: 'linear-gradient(180deg, rgba(254, 242, 242, 0.9) 0%, #fff 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(239, 68, 68, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={22} style={{ color: 'var(--red-600, #dc2626)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 8 }}>
                Deactivate your account
              </h3>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--slate-600)', marginBottom: 12 }}>
                Deactivation signs you out and blocks access to this customer portal until the cooperative clears
                it (for example after you contact{' '}
                <a href="mailto:safetravels.transportcoop@gmail.com" style={{ fontWeight: 700, color: 'var(--brand-gold-dark)' }}>
                  safetravels.transportcoop@gmail.com
                </a>
                ). It is <strong>not</strong> the same as deleting all data: we may keep billing and trip records
                as described in our policies and applicable law.
              </p>
              <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 16 }}>
                Read the full wording in our{' '}
                <Link to="/privacy#account-deactivation" style={{ fontWeight: 700, color: 'var(--brand-gold-dark)' }}>
                  Privacy policy
                </Link>{' '}
                and{' '}
                <Link to="/terms#account-deactivation" style={{ fontWeight: 700, color: 'var(--brand-gold-dark)' }}>
                  Terms of service
                </Link>
                .
              </p>
              <button
                type="button"
                onClick={() => setDeactivateOpen(true)}
                className="btn"
                style={{
                  height: 48,
                  padding: '0 24px',
                  fontSize: 14,
                  fontWeight: 700,
                  background: 'white',
                  border: '1px solid rgba(239, 68, 68, 0.45)',
                  color: '#b91c1c',
                }}
              >
                Deactivate my account
              </button>
            </div>
          </div>
        </div>
      </div>

      {deactivateOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
          onClick={() => !deactivating && setDeactivateOpen(false)}
        >
          <div
            className="card"
            style={{ maxWidth: 440, width: '100%', padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Confirm deactivation</h4>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--slate-600)', marginBottom: 16 }}>
              You will lose access to bookings, billing, and tracking until the cooperative re-enables your
              account. Type <strong>DEACTIVATE</strong> to confirm.
            </p>
            <input
              type="text"
              value={deactivateConfirm}
              onChange={(e) => setDeactivateConfirm(e.target.value)}
              placeholder="DEACTIVATE"
              autoComplete="off"
              style={{
                width: '100%',
                height: 44,
                marginBottom: 20,
                padding: '0 14px',
                borderRadius: 10,
                border: '1px solid var(--slate-200)',
                fontSize: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={deactivating}
                className="btn btn-outline"
                onClick={() => {
                  setDeactivateOpen(false);
                  setDeactivateConfirm('');
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deactivating}
                onClick={handleDeactivateAccount}
                className="btn"
                style={{ background: '#b91c1c', color: 'white', border: 'none' }}
              >
                {deactivating ? <Loader2 className="animate-spin" /> : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}