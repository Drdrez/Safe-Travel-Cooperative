import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export default function CustomerRegister() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    contactNumber: '',
    address: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [agreeTermsAndPrivacy, setAgreeTermsAndPrivacy] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    if (!/[A-Z]/.test(formData.password)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      toast.error('Password must contain at least one number');
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      toast.error('Password must contain at least one special character');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!agreeTermsAndPrivacy) {
      toast.error('Please confirm you agree to the terms of service and privacy policy');
      return;
    }

    const digits = formData.contactNumber.replace(/\D+/g, '');
    if (digits.length < 10) {
      toast.error('Please enter a valid contact number (at least 10 digits)');
      return;
    }

    setIsLoading(true);
    const toastId = toast.loading('Creating your account...');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            contact_number: formData.contactNumber,
            address: formData.address,
            role: 'customer',
          },
        },
      });

      if (error) {
        toast.error(error.message, { id: toastId });
        setIsLoading(false);
        return;
      }

      if (data.user) {
        await supabase.from('profiles').upsert(
          [{
            id: data.user.id,
            role: 'customer',
            full_name: formData.fullName,
            email: formData.email,
            contact_number: formData.contactNumber,
            address: formData.address,
          }],
          { onConflict: 'id' }
        );

        if (data.session) {
          toast.success('Membership granted! You are now logged in.', { id: toastId });
          localStorage.setItem('customerLoggedIn', 'true');
          localStorage.setItem('customerName', formData.fullName);
          localStorage.setItem('customerEmail', formData.email);
          setTimeout(() => navigate('/customer'), 1500);
        } else {
          toast.success('Registration successful! Please check your email for the confirmation link.', { id: toastId, duration: 6000 });
          setTimeout(() => navigate('/login'), 2000);
        }
      }
      setIsLoading(false);
    } catch (err: any) {
      toast.error('An unexpected error occurred: ' + (err?.message || 'Unknown error'), { id: toastId });
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page" style={{ padding: '20px' }}>
      <div className="login-card" style={{ maxWidth: 560, padding: '32px 40px' }}>
        <div className="logo-circle" style={{ width: 64, height: 64, marginBottom: 16 }}>
          <img src="/sttc_logo.png" alt="STTC Logo" />
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 4 }}>Customer Registration</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>
            Submit details to get started.
          </p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid-2">
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)' }}>Full Name</label>
                <input
                    name="fullName"
                    placeholder="Full name"
                    value={formData.fullName}
                    onChange={handleChange}
                    style={{
                        width: '100%', height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--slate-50)', border: '1px solid var(--slate-100)', outline: 'none', fontSize: 13
                    }}
                    required
                />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)' }}>Email Address</label>
                <input
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    style={{
                        width: '100%', height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--slate-50)', border: '1px solid var(--slate-100)', outline: 'none', fontSize: 13
                    }}
                    required
                />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)' }}>Contact Number</label>
                <input
                    name="contactNumber"
                    placeholder="+63..."
                    value={formData.contactNumber}
                    onChange={handleChange}
                    style={{
                        width: '100%', height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--slate-50)', border: '1px solid var(--slate-100)', outline: 'none', fontSize: 13
                    }}
                    required
                />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)' }}>Complete Address</label>
                <input
                    name="address"
                    placeholder="City, Province"
                    value={formData.address}
                    onChange={handleChange}
                    style={{
                        width: '100%', height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--slate-50)', border: '1px solid var(--slate-100)', outline: 'none', fontSize: 13
                    }}
                    required
                />
            </div>
          </div>

          <div className="grid-2" style={{ paddingTop: 8, borderTop: '1px solid var(--slate-50)' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                    <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        style={{
                            width: '100%', height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)',
                            background: 'var(--slate-50)', border: '1px solid var(--slate-100)', outline: 'none', fontSize: 13
                        }}
                        required
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                    >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {[
                        { id: 'len', label: '8+ Chars', met: formData.password.length >= 8 },
                        { id: 'up', label: 'Uppercase', met: /[A-Z]/.test(formData.password) },
                        { id: 'num', label: 'Number', met: /[0-9]/.test(formData.password) },
                        { id: 'sym', label: 'Symbol', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
                    ].map(rule => (
                        <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ 
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 14, height: 14, borderRadius: '50%', 
                                background: rule.met ? 'var(--emerald-500)' : 'var(--slate-100)',
                                transition: 'all 0.3s'
                            }}>
                                {rule.met ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="var(--slate-400)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ width: 8, height: 8 }}>
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                )}
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, color: rule.met ? 'var(--slate-900)' : 'var(--slate-400)' }}>{rule.label}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--slate-600)' }}>Confirm Password</label>
                <input
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    style={{
                        width: '100%', height: 44, padding: '0 14px', borderRadius: 'var(--radius-md)',
                        background: 'var(--slate-50)', border: '1px solid var(--slate-100)', outline: 'none', fontSize: 13
                    }}
                    required
                />
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--slate-600)',
              cursor: 'pointer',
              marginTop: 8,
            }}
          >
            <input
              type="checkbox"
              checked={agreeTermsAndPrivacy}
              onChange={(e) => setAgreeTermsAndPrivacy(e.target.checked)}
              style={{ marginTop: 3, width: 16, height: 16, accentColor: 'var(--brand-gold)' }}
            />
            <span>
              I agree to the{' '}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-gold-dark)', fontWeight: 700 }}>
                terms of service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-gold-dark)', fontWeight: 700 }}>
                privacy policy
              </Link>
              .
            </span>
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-brand"
            style={{ width: '100%', height: 48, marginTop: 8 }}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>Submit Registration <UserPlus size={18} /></>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>
              Already part of the cooperative? <Link to="/login" style={{ color: 'var(--brand-gold-dark)', fontWeight: 700 }}>Login here</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}