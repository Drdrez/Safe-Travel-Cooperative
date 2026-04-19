import { useState, useEffect } from 'react';
import { User, Eye, EyeOff, Loader2, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export default function ProfileSettings() {
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
      </div>
    </div>
  );
}