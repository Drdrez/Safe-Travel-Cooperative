import { useEffect, useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

function validateNewPassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number';
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(pw)) return 'Password must contain at least one special character';
  return null;
}

export function ResetPassword() {
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
      window.location.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not update password';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container" style={{ position: 'relative' }}>
        <a
          href="/"
          style={{
            position: 'absolute',
            top: 20,
            left: 24,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--slate-500)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={14} /> Back to sign in
        </a>

        <div className="login-brand">
          <img src="/sttc_logo.png" alt="STTC Logo" className="login-logo-img" />
          <h1>Set new password</h1>
          <p>
            {ready
              ? 'Choose a strong password for your admin account.'
              : 'Loading your reset session…'}
          </p>
        </div>

        {ready ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">New password</label>
              <div className="form-input-wrapper">
                <KeyRound className="form-input-icon" />
                <input
                  className="form-input has-icon"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--slate-400)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { id: 'len', label: '8+ Chars', met: password.length >= 8 },
                  { id: 'up', label: 'Uppercase', met: /[A-Z]/.test(password) },
                  { id: 'num', label: 'Number', met: /[0-9]/.test(password) },
                  { id: 'sym', label: 'Symbol', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
                ].map((rule) => (
                  <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: rule.met ? 'var(--emerald-500)' : 'var(--slate-100)',
                        transition: 'all 0.3s',
                      }}
                    >
                      {rule.met ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: 12, height: 12 }}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--slate-400)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ width: 8, height: 8 }}
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: rule.met ? 'var(--slate-900)' : 'var(--slate-400)',
                      }}
                    >
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm password</label>
              <div className="form-input-wrapper">
                <KeyRound className="form-input-icon" />
                <input
                  className="form-input has-icon"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-brand btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Update password'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--slate-500)', textAlign: 'center', lineHeight: 1.6 }}>
            If this page does not load, open the link from your email again, or{' '}
            <a href="/forgot-password" style={{ color: 'var(--brand-gold-dark)', fontWeight: 700 }}>
              request a new reset link
            </a>
            .
          </p>
        )}

        <div className="login-footer">Secure management portal for authorized personnel.</div>
      </div>
    </div>
  );
}
