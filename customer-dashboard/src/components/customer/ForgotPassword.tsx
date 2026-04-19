import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (error) throw error;
      setSent(true);
      toast.success('Check your email for a reset link');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not send reset email';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    height: 48,
    padding: '0 16px',
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
          <h1 style={{ fontSize: 24, marginBottom: 8, color: 'var(--slate-900)' }}>Forgot password</h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', fontWeight: 500, lineHeight: 1.5 }}>
            {sent
              ? 'If an account exists for that email, we sent a link to reset your password.'
              : 'Enter your email and we will send you a link to choose a new password.'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-600)' }}>Email address</label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-brand"
              style={{ width: '100%', height: 48, marginTop: 12 }}
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : 'Send reset link'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--slate-500)', textAlign: 'center', lineHeight: 1.6 }}>
            Did not get an email? Check spam or{' '}
            <button
              type="button"
              onClick={() => setSent(false)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--brand-gold-dark)',
                fontWeight: 700,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              try a different address
            </button>
            .
          </p>
        )}
      </div>
    </div>
  );
}
