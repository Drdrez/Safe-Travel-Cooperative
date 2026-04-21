import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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
          className="legal-doc"
          style={{
            background: 'white',
            borderRadius: 16,
            border: '1px solid var(--slate-100)',
            boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
          }}
        >
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--slate-900)', marginBottom: 8 }}>
            Privacy policy
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
            This notice is provided as a starting point only. Safe Travel Transport Cooperative should
            have it reviewed and adapted by qualified legal counsel to match real processing activities,
            local law, and any contracts you enter with members or customers.
          </p>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>1. Who we are</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              <strong>Safe Travel Transport Cooperative</strong> (“we”, “us”) operates this website and
              related services for booking, membership, billing, and support. For privacy questions,
              contact us at{' '}
              <a href="mailto:safetravels.transportcoop@gmail.com" style={{ color: 'var(--brand-gold-dark)', fontWeight: 600 }}>
                safetravels.transportcoop@gmail.com
              </a>
              .
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>2. What we collect</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)', marginBottom: 12 }}>
              Depending on how you use our services, we may process:
            </p>
            <ul style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--slate-700)', paddingLeft: 20 }}>
              <li>
                <strong>Account and identity:</strong> name, email, phone, address, and credentials you
                provide when you register or update your profile.
              </li>
              <li>
                <strong>Bookings and operations:</strong> trip details, vehicle choices, schedules,
                payments or receipts, cancellations, and communications about your rides.
              </li>
              <li>
                <strong>Technical data:</strong> device/browser type, approximate location when you use
                features such as tracking (where enabled), and security-related logs.
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>3. Why we use data</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              We use personal data to provide and improve our services (for example: creating and
              managing accounts, processing reservations, coordinating drivers and vehicles, billing,
              customer support, safety, fraud prevention, and meeting legal or regulatory obligations).
              Where required, we rely on your consent—for example, marketing communications if we offer
              them and you opt in.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>4. Storage and security</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              Data is stored using reputable cloud infrastructure (including authentication and database
              services). We apply access controls and technical measures appropriate to the nature of the
              data. No method of transmission over the internet is completely secure; we work to protect
              your information but cannot guarantee absolute security.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>5. Sharing</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              We do not sell your personal data. We may share information with service providers who help
              us run the platform (for example hosting, email delivery, or maps), subject to contracts
              that require them to protect the data and use it only for the services we request. We may
              also disclose information if required by law or to protect rights, safety, and security.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>6. Retention</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              We keep information only as long as needed for the purposes above, including legal,
              accounting, or dispute-resolution requirements. When data is no longer required, we delete or
              anonymize it in line with our internal policies.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>7. Your choices</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              You may request access to, or correction of, your personal data where applicable. You may
              also ask about deletion, subject to exceptions (such as records we must keep by law). Contact
              us at the email above. We may need to verify your identity before fulfilling certain
              requests.
            </p>
          </section>

          <section id="account-deactivation" style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
              8. Deactivating your customer account
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)', marginBottom: 12 }}>
              If you use the customer portal, you may <strong>deactivate</strong> your account from Profile
              settings. Deactivation means we mark your account so you can no longer sign in to the portal
              until the cooperative clears that status (for example after you contact us and we verify your
              request).
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)', marginBottom: 12 }}>
              <strong>Deactivation is not the same as erasing all data.</strong> We may keep information
              required for accounting, disputes, safety, and legal compliance—including past trips,
              reservations, and billing history—even after you deactivate. How long we retain data is
              described in the Retention section above.
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              To request <strong>reinstatement</strong> of portal access, or to discuss{' '}
              <strong>stronger deletion or anonymization</strong> of your information, email us at the
              address in section 1. We will respond in line with applicable law and our operational
              capabilities.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>9. Cookies and similar technologies</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              We may use cookies or local storage to keep you signed in and to remember preferences. You
              can control cookies through your browser settings; disabling some cookies may limit certain
              features.
            </p>
          </section>

          <section style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>10. Changes</h2>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--slate-700)' }}>
              We may update this policy from time to time. We will post the revised version on this page and
              update the “Last updated” date. Continued use of the services after changes means you accept
              the updated policy, except where your consent is required by law.
            </p>
          </section>

          <p style={{ fontSize: 13, color: 'var(--slate-500)', marginTop: 8 }}>
            See also our{' '}
            <Link to="/terms" style={{ color: 'var(--brand-gold-dark)', fontWeight: 600 }}>
              Terms of service
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
