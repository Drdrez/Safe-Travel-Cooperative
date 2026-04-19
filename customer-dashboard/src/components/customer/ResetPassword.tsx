import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

function validateNewPassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const markReadyIfSession = (session: Session | null) => {
      if (!cancelled && session?.user) setReady(true);
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      markReadyIfSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || session?.user) markReadyIfSession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateNewPassword(password);
    if (err) {
      toast.error(err);
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated. You can sign in with your new password.');
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not update password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: 48,
    padding: '0 16px',
    paddingRight: 48,
    borderRadius: 'var(--radius-md)',
    background: 'var(--slate-50)',
    border: '1px solid var(--slate-100)',
    fontSize: 14,
    outline: 'none',
    transition: 'all 0.2s',
  } as const;

  return (
    <div className="login-page">
      <div className="login-card">
        <Link
          to="/login"
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
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        <div className="logo-circle">
          <img src="/sttc_logo.png" alt="STTC Logo" />
        </div>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8, color: 'var(--slate-900)' }}>Set new password</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500 }}>
            {ready
              ? 'Choose a strong password for your account.'
              : 'Loading your reset session…'}
          </p>
        </div>

        {ready ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-600)' }}>New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  style={inputStyle}
                  onFocus={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = 'var(--brand-gold)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.background = 'var(--slate-50)';
                    e.currentTarget.style.borderColor = 'var(--slate-100)';
                  }}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--slate-400)',
                  }}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-600)' }}>Confirm password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="form-input"
                style={{ ...inputStyle, paddingRight: 16 }}
                onFocus={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.borderColor = 'var(--brand-gold)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.background = 'var(--slate-50)';
                  e.currentTarget.style.borderColor = 'var(--slate-100)';
                }}
                disabled={loading}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-brand"
              style={{ width: '100%', height: 48, marginTop: 12 }}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Update password'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--slate-500)', textAlign: 'center', lineHeight: 1.6 }}>
            If this page does not load, open the link from your email again, or{' '}
            <Link to="/forgot-password" style={{ color: 'var(--brand-gold-dark)', fontWeight: 700 }}>
              request a new reset link
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
