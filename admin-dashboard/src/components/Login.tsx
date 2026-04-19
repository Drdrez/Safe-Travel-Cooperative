import { useState } from 'react';
import { Shield, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.user) {
        toast.error(error?.message || 'Invalid credentials');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        toast.error('Your account does not have administrator access.');
        return;
      }

      toast.success('Welcome back');
      onLogin();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-brand">
          <img src="/sttc_logo.png" alt="STTC Logo" className="login-logo-img" />
          <h1>Admin Portal</h1>
          <p>Safe Travel Cooperative Management</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="form-input-wrapper">
              <Shield className="form-input-icon" />
              <input
                className="form-input has-icon"
                type="email"
                placeholder="admin@safetravel.coop"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="form-input-wrapper">
              <KeyRound className="form-input-icon" />
              <input
                className="form-input has-icon"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <a
                href="/forgot-password"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--brand-gold-dark)',
                  textDecoration: 'none',
                }}
              >
                Forgot password?
              </a>
            </div>
          </div>

          <button type="submit" className="btn btn-brand btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : (
              <>
                Sign in to Dashboard
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          Secure management portal for authorized personnel.
        </div>
      </div>
    </div>
  );
}
