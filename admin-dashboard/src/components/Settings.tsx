import { useEffect, useState } from 'react';
import { Upload, Loader2, KeyRound, CreditCard, Ban, UserPlus, HandCoins, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type CoopInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
  logo_url: string;
};

type OpPrefs = {
  currency: string;
  tax_rate: number;
  buffer_minutes: number;
  default_daily_rate: number;
  cancellation_fee_pct: number;
  cancellation_window_hours: number;
  online_payments_enabled: boolean;
  enforce_cancellation_fee: boolean;
  accept_member_applications: boolean;
  accept_loan_applications: boolean;
  maintenance_mode: boolean;
};

const DEFAULT_COOP_INFO: CoopInfo = {
  name: 'Safe Travel Cooperative',
  email: 'admin@safetravel.coop',
  phone: '(555) 000-0000',
  address: '123 Main Street, City, State 12345',
  logo_url: '',
};

const DEFAULT_OP_PREFS: OpPrefs = {
  currency: 'PHP',
  tax_rate: 12,
  buffer_minutes: 60,
  default_daily_rate: 3500,
  cancellation_fee_pct: 10,
  cancellation_window_hours: 2,
  online_payments_enabled: true,
  enforce_cancellation_fee: true,
  accept_member_applications: true,
  accept_loan_applications: true,
  maintenance_mode: false,
};

export function Settings() {
  const [coop, setCoop] = useState<CoopInfo>(DEFAULT_COOP_INFO);
  const [prefs, setPrefs] = useState<OpPrefs>(DEFAULT_OP_PREFS);
  const [loading, setLoading] = useState(true);
  const [savingCoop, setSavingCoop] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [currentEmail, setCurrentEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      setCurrentEmail(authData?.user?.email || '');

      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['coop_info', 'op_prefs']);

      if (error) {
        toast.error(`Couldn't load settings: ${error.message}. Run the SQL migration to create the app_settings table.`);
      } else if (data) {
        data.forEach(row => {
          if (row.key === 'coop_info') setCoop({ ...DEFAULT_COOP_INFO, ...(row.value || {}) });
          if (row.key === 'op_prefs') setPrefs({ ...DEFAULT_OP_PREFS, ...(row.value || {}) });
        });
      }
      setLoading(false);
    })();
  }, []);

  const upsertSetting = async (key: string, value: Record<string, unknown>) => {
    const { data: authData } = await supabase.auth.getUser();
    return supabase
      .from('app_settings')
      .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: authData?.user?.id || null });
  };

  const saveCoopInfo = async () => {
    setSavingCoop(true);
    const { error } = await upsertSetting('coop_info', coop);
    setSavingCoop(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Cooperative information saved');
  };

  const saveOpPrefs = async () => {
    setSavingPrefs(true);
    const { error } = await upsertSetting('op_prefs', prefs);
    setSavingPrefs(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Operational preferences saved');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('File too large (max 2MB)'); return; }
    const reader = new FileReader();
    reader.onloadend = () => setCoop(prev => ({ ...prev, logo_url: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEmail) { toast.error('Missing account email'); return; }
    if (!currentPassword) { toast.error('Enter your current password'); return; }
    if (newPassword.length < 8) { toast.error('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }

    setChangingPassword(true);
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });
    if (verifyErr) {
      toast.error('Current password is incorrect');
      setChangingPassword(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) { toast.error(error.message); return; }

    toast.success('Password changed');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240, color: 'var(--slate-400)', gap: 8 }}>
        <Loader2 className="animate-spin" size={18} /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="page-header">
        <div><h1>Settings</h1><p>These settings live in the database and apply to the whole cooperative.</p></div>
      </div>

      <div className="grid-2" style={{ gap: 24, alignItems: 'start' }}>
        {/* Cooperative Info */}
        <div className="card space-y-4">
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Cooperative Information</h2>

          <div className="form-group">
            <label className="form-label">Cooperative Name</label>
            <input className="form-input" value={coop.name} onChange={e => setCoop({ ...coop, name: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">Cooperative Logo</label>
            <input type="file" id="logo-upload" style={{ display: 'none' }} accept="image/*" onChange={handleLogoUpload} />
            <div
              onClick={() => document.getElementById('logo-upload')?.click()}
              style={{
                border: '2px dashed var(--slate-200)', borderRadius: 'var(--radius-lg)',
                padding: 32, textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s', overflow: 'hidden'
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-gold)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--slate-200)')}
            >
              {coop.logo_url ? (
                <img src={coop.logo_url} alt="Logo" style={{ height: 80, margin: '0 auto', objectFit: 'contain' }} />
              ) : (
                <>
                  <Upload size={36} style={{ color: 'var(--slate-300)', margin: '0 auto 12px' }} />
                  <p style={{ fontWeight: 600, fontSize: 13 }}>Click to upload logo</p>
                  <p style={{ fontSize: 10, color: 'var(--slate-400)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>PNG, JPG • Max 2MB</p>
                </>
              )}
            </div>
          </div>

          <div className="form-group"><label className="form-label">Contact Email</label><input className="form-input" type="email" value={coop.email} onChange={e => setCoop({ ...coop, email: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Contact Phone</label><input className="form-input" type="tel" value={coop.phone} onChange={e => setCoop({ ...coop, phone: e.target.value })} /></div>
          <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" value={coop.address} onChange={e => setCoop({ ...coop, address: e.target.value })} rows={3} /></div>

          <button className="btn btn-brand btn-md w-full" onClick={saveCoopInfo} disabled={savingCoop}>
            {savingCoop ? <Loader2 size={16} className="animate-spin" /> : 'Save Cooperative Info'}
          </button>
        </div>

        <div className="space-y-6">
          {/* Operational Preferences */}
          <div className="card space-y-4">
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Operational Preferences</h2>

            <div className="grid-2 space-y-4">
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select className="form-select" value={prefs.currency} onChange={e => setPrefs({ ...prefs, currency: e.target.value })}>
                  <option value="PHP">₱ Philippine Peso (PHP)</option>
                  <option value="USD">$ US Dollar (USD)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tax Rate (%)</label>
                <input className="form-input" type="number" value={prefs.tax_rate} onChange={e => setPrefs({ ...prefs, tax_rate: Number(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Booking Buffer (min)</label>
                <input className="form-input" type="number" value={prefs.buffer_minutes} onChange={e => setPrefs({ ...prefs, buffer_minutes: Number(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Default Daily Rate (₱)</label>
                <input className="form-input" type="number" value={prefs.default_daily_rate} onChange={e => setPrefs({ ...prefs, default_daily_rate: Number(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Cancellation Fee (%)</label>
                <input className="form-input" type="number" value={prefs.cancellation_fee_pct} onChange={e => setPrefs({ ...prefs, cancellation_fee_pct: Number(e.target.value) || 0 })} />
              </div>
              <div className="form-group">
                <label className="form-label">Cancel window (h)</label>
                <input className="form-input" type="number" value={prefs.cancellation_window_hours} onChange={e => setPrefs({ ...prefs, cancellation_window_hours: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--slate-100)', margin: '8px 0' }} />
            <h3
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--slate-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 4,
              }}
            >
              Feature toggles
            </h3>
            <p style={{ fontSize: 12, color: 'var(--slate-500)', marginBottom: 4 }}>
              Flip these to temporarily open or close parts of the service. Changes apply the next
              time customers load the affected screen.
            </p>

            <Toggle
              icon={CreditCard}
              label="Accept online payments"
              desc="Customers can submit payments through the portal. Turn off to require on-site/cash payments."
              checked={prefs.online_payments_enabled}
              onChange={(v) => setPrefs({ ...prefs, online_payments_enabled: v })}
            />
            <Toggle
              icon={Ban}
              label="Enforce cancellation fee"
              desc="Apply the cancellation fee % above when customers cancel outside the free-cancel window."
              checked={prefs.enforce_cancellation_fee}
              onChange={(v) => setPrefs({ ...prefs, enforce_cancellation_fee: v })}
            />
            <Toggle
              icon={UserPlus}
              label="Accept new member applications"
              desc="Show the 'become a member' flow on the customer portal."
              checked={prefs.accept_member_applications}
              onChange={(v) => setPrefs({ ...prefs, accept_member_applications: v })}
            />
            <Toggle
              icon={HandCoins}
              label="Accept loan applications"
              desc="Let existing members apply for cooperative loans."
              checked={prefs.accept_loan_applications}
              onChange={(v) => setPrefs({ ...prefs, accept_loan_applications: v })}
            />
            <Toggle
              icon={AlertTriangle}
              label="Maintenance mode"
              desc="Show a site-wide banner so customers know the service is being updated."
              checked={prefs.maintenance_mode}
              onChange={(v) => setPrefs({ ...prefs, maintenance_mode: v })}
              tone="warning"
            />

            <button className={cn('btn btn-primary btn-md w-full')} onClick={saveOpPrefs} disabled={savingPrefs}>
              {savingPrefs ? <Loader2 size={16} className="animate-spin" /> : 'Save Operational Rules'}
            </button>
          </div>

          {/* Change Password */}
          <div className="card space-y-4">
            <div className="flex-start gap-2" style={{ marginBottom: 4 }}>
              <KeyRound size={16} style={{ color: 'var(--brand-gold)' }} />
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Change Admin Password</h2>
            </div>
            <p style={{ fontSize: 11, color: 'var(--slate-500)' }}>
              Signed in as <strong>{currentEmail || '—'}</strong>. We verify your current password with Supabase before rotating.
            </p>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="form-group">
                <label className="form-label">Current Password</label>
                <input type="password" className="form-input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className="form-group">
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" required placeholder="Min. 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input type="password" className="form-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
              </div>
              <button type="submit" className="btn btn-brand btn-md w-full" disabled={changingPassword}>
                {changingPassword ? <Loader2 size={16} className="animate-spin" /> : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

type ToggleProps = {
  icon: React.ComponentType<{ size?: number | string; style?: React.CSSProperties }>;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: 'default' | 'warning';
};

function Toggle({ icon: Icon, label, desc, checked, onChange, tone = 'default' }: ToggleProps) {
  const accent = tone === 'warning' ? '#f59e0b' : 'var(--brand-gold)';
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: 12,
        borderRadius: 'var(--radius-md)',
        background: checked ? 'var(--brand-gold-light)' : 'var(--slate-50)',
        border: `1px solid ${checked ? 'rgba(234,179,8,0.35)' : 'var(--slate-100)'}`,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: checked ? accent : 'var(--slate-200)',
          color: checked ? 'white' : 'var(--slate-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--slate-900)' }}>{label}</div>
        {desc && (
          <div style={{ fontSize: 11, color: 'var(--slate-500)', marginTop: 2, lineHeight: 1.4 }}>
            {desc}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 999,
          background: checked ? accent : 'var(--slate-300)',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 20 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            transition: 'left 0.2s',
          }}
        />
      </button>
    </label>
  );
}
