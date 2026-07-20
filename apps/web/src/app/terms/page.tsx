import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal/LegalPageLayout";

export const metadata: Metadata = {
  title: "Terms of Service — APEX PAY",
  description: "The terms governing use of the APEX PAY contribution-based savings queue platform.",
};

const LAST_UPDATED = "18 July 2026";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <LegalSection heading="1. What APEX PAY is">
        <p>
          APEX PAY is a contribution-based savings queue. You choose a savings level, contribute that level&apos;s
          fixed amount, and are matched in turn with another member so that contributions and payouts move
          through the queue in order. Some members refer to their contribution informally as their
          &quot;investment,&quot; but <strong>APEX PAY does not operate like a traditional investment product and
          does not promise a fixed or guaranteed rate of return.</strong> Under the core savings mechanism, you
          always receive back exactly what you contributed, minus a platform fee. Depending on your level, you
          may also receive an additional level incentive bonus — a separate, capped benefit funded only from
          platform fee revenue and never guaranteed, described further in Section 5. Wherever this site refers
          to your contribution being &quot;returned&quot; or getting your &quot;investment back,&quot; it means
          exactly that: your original contribution paid back to you, plus this optional bonus where your level
          offers one — never a promised profit, interest, or guaranteed additional return.
        </p>
      </LegalSection>

      <LegalSection heading="2. Eligibility and account registration">
        <ul>
          <li>You must be at least 18 years old and legally capable of entering a binding agreement.</li>
          <li>You must register with a phone number you control and verify it by one-time passcode (OTP).</li>
          <li>
            You must complete identity verification (KYC) before joining any level&apos;s queue. We collect an
            identity document type and number, which is encrypted before storage — see our{" "}
            <a href="/privacy">Privacy Policy</a> for detail.
          </li>
          <li>You may hold only one account. Operating multiple accounts is a violation of these Terms (Section 8).</li>
          <li>
            You are responsible for keeping your PIN, and where enabled, your multi-factor authentication device,
            confidential. Notify us immediately if you suspect unauthorized access.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="3. How the contribution queue works">
        <ul>
          <li>
            Each savings level has a fixed contribution amount. Joining a level places you in that level&apos;s
            FIFO (first-in, first-out) queue.
          </li>
          <li>
            When matched, you send your contribution directly to APEX PAY&apos;s designated collection account and
            upload proof of payment. Once confirmed received, the matched payee&apos;s payout is disbursed to
            their registered bank account.
          </li>
          <li>
            A platform fee (disclosed per level before you join) is deducted from each contribution before
            payout. The fee funds platform operations, the referral bonus pool, and the level incentive bonus
            pool described in Section 5.
          </li>
          <li>
            Disputes over a specific contribution or payout can be raised in-app and are reviewed and resolved
            by an administrator, who may confirm the transaction as legitimate or void the match and return
            both parties to the queue.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="4. Payout timing is not guaranteed">
        <p>
          <strong>How long you wait for a payout depends on how quickly new members join your level&apos;s queue
          behind you — it is not a fixed or guaranteed timeframe.</strong> We show a real-time, data-driven
          estimate in your dashboard, but queue liquidity can move faster or slower than that estimate,
          particularly in a level&apos;s early days or during periods of lower signups. The first member to join a
          new level has no one ahead of them to be paid by and will wait until a second member joins. By joining
          a queue, you acknowledge and accept this timing risk.
        </p>
      </LegalSection>

      <LegalSection heading="5. Referral bonuses and the level incentive bonus">
        <ul>
          <li>
            <strong>Referral bonus:</strong> shared referral codes may earn the referrer a bonus once the
            referred member&apos;s first contribution cycle is confirmed complete — not merely at sign-up. Referral
            bonuses are funded entirely from APEX PAY&apos;s fee revenue, never from another member&apos;s
            contribution, and are held for 30 working days before becoming withdrawable, as a standard
            anti-fraud safeguard.
          </li>
          <li>
            <strong>Level incentive bonus:</strong> higher savings levels may offer an additional bonus on top of
            your returned contribution. This bonus is strictly capped by what is actually available in the
            platform&apos;s accumulated incentive fee pool at the moment of your payout. If the pool is thin, your
            bonus may be reduced or paid as zero — it is never borrowed against future fee revenue.{" "}
            <strong>The level incentive bonus is described as &quot;up to&quot; a rate. It is never a guaranteed
            return</strong>, and nothing in our marketing or in-app copy should be read as promising otherwise.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="6. Fees">
        <p>
          The platform fee percentage for each level is shown before you join that level&apos;s queue. We may
          change fee percentages for future contributions with notice in-app; changes do not apply
          retroactively to a contribution you have already made.
        </p>
      </LegalSection>

      <LegalSection heading="7. Account suspension, ban, and reinstatement">
        <p>
          We may suspend or ban an account that violates these Terms, is linked to fraudulent activity, or
          poses a risk to other members or to the platform, with a reason recorded internally for every such
          action. A suspended or banned account cannot join queues or receive payouts. Reinstatement is at our
          discretion and may require renewed identity verification.
        </p>
      </LegalSection>

      <LegalSection heading="8. Prohibited conduct">
        <ul>
          <li>Registering or controlling more than one account.</li>
          <li>Providing false identity information or KYC documents.</li>
          <li>Self-referring, or coordinating referrals across accounts you control, to farm referral bonuses.</li>
          <li>Uploading falsified proof of payment.</li>
          <li>Using APEX PAY for money laundering, terrorist financing, or any other unlawful purpose.</li>
          <li>Attempting to interfere with, reverse-engineer, or abuse the queue-matching system.</li>
        </ul>
        <p>We use heuristic fraud detection (for example, shared payout bank details across accounts, or unusual referral signup bursts) to flag accounts for human review. These flags direct review — they do not by themselves suspend an account.</p>
      </LegalSection>

      <LegalSection heading="9. Identity verification and compliance">
        <p>
          Collecting funds from many members and redistributing them functions, in substance, as a
          payment/money-transmission activity. We require identity verification consistent with standard
          know-your-customer (KYC) and anti-money-laundering (AML) practice, and we cooperate with lawful
          requests from Nigerian regulatory and law enforcement authorities.
        </p>
      </LegalSection>

      <LegalSection heading="10. Limitation of liability">
        <p>
          To the fullest extent permitted by law, APEX PAY is not liable for indirect, incidental, or
          consequential losses arising from your use of the platform, including losses arising from delays in
          queue payout timing disclosed in Section 4. Nothing in these Terms limits liability that cannot be
          limited under applicable Nigerian law.
        </p>
      </LegalSection>

      <LegalSection heading="11. Changes to these Terms">
        <p>
          We may update these Terms as the platform evolves. Material changes will be announced in-app before
          they take effect. Continuing to use APEX PAY after a change takes effect constitutes acceptance of
          the updated Terms.
        </p>
      </LegalSection>

      <LegalSection heading="12. Governing law">
        <p>These Terms are governed by the laws of the Federal Republic of Nigeria.</p>
      </LegalSection>

      <LegalSection heading="13. Contact">
        <p>Questions about these Terms can be directed to our support team from your dashboard once support channels are live.</p>
      </LegalSection>
    </LegalPageLayout>
  );
}
