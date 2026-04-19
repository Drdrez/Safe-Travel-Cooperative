import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

/**
 * Template terms of service — have it reviewed by qualified counsel for your jurisdiction
 * and your actual business rules before relying on it.
 */
export default function TermsOfService() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--slate-50)',
        padding: '32px 20px 64px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--slate-600)',
            marginBottom: 24,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <div
          style={{
            background: 'white',
            borderRadius: 16,
            padding: '36px 32px',
            border: '1px solid var(--slate-100)',
            boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 8 }}>
            Terms of service
          </h1>
          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginBottom: 28 }}>
            Last updated: April 19, 2026
          </p>

          <p
            style={{
              fontSize: 13,
              lineHeight: 1.65,
              padding: 14,
              borderRadius: 10,
              background: 'var(--amber-50)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              color: 'var(--slate-700)',
              marginBottom: 28,
            }}
          >
            These terms are a starting point only. Safe Travel Transport Cooperative should have them
            reviewed by qualified legal counsel and adapted to your fares, cancellation rules, liability
            limits, and governing law.
          </p>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>1. Agreement</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              By accessing this website, creating an account, or using booking, membership, billing, or
              support services operated by <strong>Safe Travel Transport Cooperative</strong> (“we”,
              “us”), you agree to these Terms of Service and our{' '}
              <Link to="/privacy" style={{ color: 'var(--brand-gold-dark)', fontWeight: 600 }}>
                Privacy policy
              </Link>
              . If you do not agree, do not use the services.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>2. Eligibility and accounts</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              You must provide accurate registration information and keep your credentials secure. You are
              responsible for activity under your account. Notify us promptly if you suspect unauthorized
              access.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>3. Services</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              We provide cooperative transport–related services as described on this site (including
              reservations, tracking where available, and member features). Features may change; we may
              suspend or modify the service for maintenance, safety, or legal reasons.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>4. Bookings, fees, and payment</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              Prices shown before you confirm a booking are part of your agreement for that trip. Payment
              methods, taxes, and cooperative fees (if any) will be as stated at checkout or in your
              membership terms. Late payments or chargebacks may result in suspension of service where
              permitted by law.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>5. Cancellations and changes</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              Cancellation and reschedule rules (including any fees or windows) are those published in the
              app or communicated at booking. We may cancel or reassign trips for safety, weather,
              operational, or force-majeure reasons and will use reasonable efforts to notify you.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>6. Acceptable use</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              You will not misuse the services (for example: fraud, harassment of drivers or staff,
              interfering with systems, or violating applicable law). We may suspend or terminate access for
              violations.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>7. Disclaimers</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              Services are provided on an “as is” and “as available” basis to the extent permitted by law.
              We do not guarantee uninterrupted or error-free operation. Nothing in these terms excludes
              or limits liability that cannot be excluded or limited under applicable law.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>8. Limitation of liability</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              To the maximum extent permitted by law, our total liability arising out of these terms or the
              services is limited to the amount you paid us for the specific transaction giving rise to
              the claim in the twelve (12) months before the claim, or a nominal amount if none—except
              where a stricter rule applies by law. Counsel should set caps and carve-outs for your
              jurisdiction.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>9. Indemnity</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              You agree to defend and indemnify us against third-party claims arising from your misuse of
              the services or violation of these terms, to the extent permitted by law.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>10. Changes to these terms</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              We may update these terms by posting a new version on this page and changing the “Last
              updated” date. Continued use after changes constitutes acceptance, except where your consent
              is required by law.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>11. Governing law</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              These terms are governed by the laws of the Philippines, without regard to conflict-of-law
              rules, unless your counsel specifies a different approach. Disputes may be brought in the
              courts of competent jurisdiction as determined by your lawyer.
            </p>
          </section>

          <section style={{ marginBottom: 8 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>12. Contact</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              Questions about these terms:{' '}
              <a href="mailto:safetravels.transportcoop@gmail.com" style={{ color: 'var(--brand-gold-dark)', fontWeight: 600 }}>
                safetravels.transportcoop@gmail.com
              </a>
              .
            </p>
          </section>

          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 24 }}>
            See also our{' '}
            <Link to="/privacy" style={{ color: 'var(--brand-gold-dark)', fontWeight: 600 }}>
              Privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
