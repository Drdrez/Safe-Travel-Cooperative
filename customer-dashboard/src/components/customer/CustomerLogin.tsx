import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !data.user) {
        toast.error(authError?.message || 'Invalid credentials');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role, deactivated_at')
        .eq('id', data.user.id)
        .single();

      if (profile?.deactivated_at) {
        await supabase.auth.signOut();
        toast.error(
          'This account is deactivated. See our Privacy policy for details, or contact the cooperative to discuss reactivation.'
        );
        return;
      }

      if (profile?.role && profile.role !== 'customer') {
        await supabase.auth.signOut();
        toast.error('This is the customer portal. Please use the admin dashboard to sign in.');
        return;
      }

      localStorage.setItem('customerName', profile?.full_name || 'Customer');
      localStorage.setItem('customerEmail', email);
      localStorage.setItem('customerLoggedIn', 'true');

      toast.success('Welcome back to Safe Travel!');
      setTimeout(() => navigate('/customer'), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <Link
          to="/"
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--slate-500)',
            padding: '6px 10px',
            borderRadius: 8,
          }}
        >
          <ArrowLeft size={14} /> Back to site
        </Link>
        <div className="logo-circle">
          <img src="/sttc_logo.png" alt="STTC Logo" />
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8, color: 'var(--slate-900)' }}>Customer Portal</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>
            Sign in to manage your bookings and trips.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-600)' }}>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                height: 48,
                padding: '0 16px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--slate-50)',
                border: '1px solid var(--slate-100)',
                fontSize: 14,
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.borderColor = 'var(--brand-gold)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.background = 'var(--slate-50)';
                e.currentTarget.style.borderColor = 'var(--slate-100)';
              }}
              disabled={isLoading}
              required
            />
          </div>

          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-600)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                style={{
                  width: '100%',
                  height: 48,
                  padding: '0 16px',
                  paddingRight: 48,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-100)',
                  fontSize: 14,
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = 'var(--brand-gold)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'var(--slate-50)';
                  e.currentTarget.style.borderColor = 'var(--slate-100)';
                }}
                disabled={isLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-brand"
            style={{ width: '100%', height: 48, marginTop: 12 }}
          >
            {isLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>Sign in to Dashboard <ArrowRight size={18} /></>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>
              New member? <Link to="/register" style={{ color: 'var(--brand-gold-dark)', fontWeight: 700 }}>Apply for Membership</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}