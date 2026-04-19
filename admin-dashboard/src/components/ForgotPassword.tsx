import { useState } from 'react';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function ForgotPassword() {
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
          <h1>Forgot password</h1>
          <p>
            {sent
              ? 'If an account exists for that email, we sent a link to reset your password.'
              : 'Enter your admin email and we will send you a reset link.'}
          </p>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="form-input-wrapper">
                <Mail className="form-input-icon" />
                <input
                  className="form-input has-icon"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@safetravel.coop"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-brand btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Send reset link'}
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--slate-500)', textAlign: 'center', lineHeight: 1.6 }}>
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

        <div className="login-footer">Secure management portal for authorized personnel.</div>
      </div>
    </div>
  );
}
