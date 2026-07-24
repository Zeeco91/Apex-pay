import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — APEX PAY",
  description: "How APEX PAY collects, protects, and uses your account data.",
};

const LAST_UPDATED = "18 July 2026";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <LegalSection heading="1. Data we collect">
        <ul>
          <li><strong>Account data:</strong> phone number, full name, and a PIN (stored only as a salted, irreversible hash — we never store or can see your raw PIN).</li>
          <li><strong>Payout details:</strong> bank name, account number, and account name, used only to send you a payout when it&apos;s your turn.</li>
          <li><strong>Transaction records:</strong> queue entries, contribution/payout history, referral relationships, and any dispute you raise.</li>
          <li><strong>Proof-of-payment images</strong> you upload when confirming a contribution.</li>
          <li><strong>Technical data:</strong> IP address and device/browser information captured at login and other security-relevant events, used for fraud detection and session security.</li>
          <li><strong>Multi-factor authentication:</strong> for admin accounts, a TOTP secret used to generate login codes — stored encrypted, never in plain text, and never visible to anyone after initial setup.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="2. How your data is protected">
        <ul>
          <li>Your payout bank details and MFA secret (where applicable) are encrypted at the database column level using AES-256-GCM — not just protected by access controls, but unreadable even from a raw database export without the separate encryption key.</li>
          <li>Your PIN is hashed with Argon2id, a memory-hard hashing algorithm designed to resist brute-force attacks even if a database were ever compromised.</li>
          <li>Login sessions use short-lived access tokens plus a separate, httpOnly, non-JavaScript-readable session cookie, reducing exposure if a browser is compromised by malicious script.</li>
          <li>Every discretionary or adverse action an administrator takes on your account (suspension, dispute resolution, and similar) is logged with the administrator&apos;s identity, a reason, and a before/after record — administrators cannot act on your account silently or without an auditable trail.</li>
          <li>Admin accounts require multi-factor authentication in addition to a password, specifically because admin actions can move real money.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. Why we use your data">
        <ul>
          <li>To operate the contribution queue: matching, confirming, and disbursing payouts.</li>
          <li>To detect and investigate fraud, including heuristic checks such as shared payout bank details across accounts or unusual referral signup patterns.</li>
          <li>To communicate with you about your account, transactions, and material changes to our terms or this policy.</li>
          <li>To comply with lawful requests from Nigerian regulatory or law enforcement authorities.</li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Who we share data with">
        <p>
          We do not sell your personal data. We share it only where necessary to operate the platform or meet a
          legal obligation — for example, with a payment or banking partner to process a disbursement, or with
          a regulator or law enforcement body under a valid legal request. Any third-party processor we use is
          required to protect your data to a standard consistent with this policy.
        </p>
      </LegalSection>

      <LegalSection heading="5. How long we keep your data">
        <p>
          We retain account and transaction data for as long as your account is active and for a further period
          afterward as required for financial record-keeping obligations under Nigerian law. Proof-of-payment
          images are retained for as long as needed to resolve any related dispute, then deleted on a rolling
          basis.
        </p>
      </LegalSection>

      <LegalSection heading="6. Your rights">
        <p>
          Under the Nigeria Data Protection Act, you have the right to request access to, correction of, or
          deletion of your personal data, subject to our legal obligation to retain certain records (Section
          5). You can update most account details directly from your dashboard; for requests we can&apos;t action
          in-app, contact support once support channels are live.
        </p>
      </LegalSection>

      <LegalSection heading="7. Cookies">
        <p>
          We use a single essential cookie to keep you logged in: an httpOnly, secure, same-site session cookie
          that cannot be read by JavaScript on any page, including ours. We do not use third-party advertising
          or tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="8. Children's privacy">
        <p>APEX PAY is not directed at, and may not be used by, anyone under 18 years old.</p>
      </LegalSection>

      <LegalSection heading="9. Changes to this policy">
        <p>
          We may update this policy as the platform evolves. Material changes will be announced in-app before
          they take effect.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>Questions about this policy can be directed to our support team from your dashboard once support channels are live.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
