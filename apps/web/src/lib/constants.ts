export const SITE_NAME = "APEX PAY";

export const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Levels", href: "#levels" },
  { label: "Referrals", href: "#faq-referral-program" },
  { label: "FAQ", href: "#faq" },
] as const;

export type Level = {
  id: string;
  name: string;
  amount: number;
  incentiveNote: string;
};

export const LEVELS: Level[] = [
  { id: "level-1", name: "Level 1", amount: 5_000, incentiveNote: "Entry level" },
  { id: "level-2", name: "Level 2", amount: 10_000, incentiveNote: "Small bonus pool access" },
  { id: "level-3", name: "Level 3", amount: 20_000, incentiveNote: "Higher bonus pool access" },
  { id: "level-4", name: "Level 4", amount: 50_000, incentiveNote: "Priority queue benefits" },
  { id: "level-5", name: "Level 5", amount: 100_000, incentiveNote: "Priority queue benefits" },
  { id: "level-6", name: "Level 6", amount: 200_000, incentiveNote: "Highest bonus pool access" },
];

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

export const HOW_IT_WORKS_STEPS = [
  {
    title: "Register with your phone number",
    description:
      "Sign up in minutes with a verified phone number. No card details required to get started.",
  },
  {
    title: "Choose your savings level",
    description:
      "Pick a contribution amount from ₦5,000 to ₦200,000 based on what works for you.",
  },
  {
    title: "Join the queue and contribute",
    description:
      "You'll be matched with a member ahead of you in your level's queue. Send your contribution and upload proof of payment.",
  },
  {
    title: "Get paid out in turn",
    description:
      "As new members join behind you, you move up the queue. When it's your turn, you receive your full contribution back.",
  },
] as const;

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "faq-is-investment",
    question: "Is APEX PAY an investment?",
    answer:
      "No. APEX PAY is a contribution-based savings queue, not an investment product. You receive back exactly what you contributed, minus a small platform fee — never more than your principal from the core savings mechanism. Any level-based bonus is a separate, capped incentive funded only from platform fee revenue, never guaranteed.",
  },
  {
    id: "faq-money-handled",
    question: "How is my money handled, and how do I know it's trustworthy?",
    answer:
      "Contributions are collected into a secure platform-held account and disbursed to members in turn by our team, following the order of each level's queue. Every step — proof of payment, confirmation, and disbursement — is tracked in your dashboard. Just as importantly, when our team manually confirms a payment, resolves a dispute, or adjusts a queue, that action is logged with a reason attached — nothing happens without an audit trail.",
  },
  {
    id: "faq-payout-timing",
    question: "How long will I wait to be paid out?",
    answer:
      "Payout timing depends on new members joining your level's queue behind you. We show an honest, real-time estimate in your dashboard, but it is not a fixed guarantee — it can move faster or slower depending on how quickly a level fills. We'd rather show you real numbers than optimistic ones.",
  },
  {
    id: "faq-referral-program",
    question: "How does the referral program work?",
    answer:
      "Four steps: (1) Share your unique referral code from your dashboard. (2) Your bonus is only triggered once your referral's first contribution cycle is confirmed complete — not just at sign-up. (3) That bonus is funded entirely out of APEX PAY's own fee revenue, never taken from another member's contribution. (4) Bonuses are held for 30 working days before becoming withdrawable, a standard anti-fraud safeguard.",
  },
  {
    id: "faq-platform-fee",
    question: "Is there a platform fee?",
    answer:
      "Yes, a 5% fee applies to each completed contribution cycle. This fee funds platform operations, the referral program, and the optional level-based incentive bonus.",
  },
  {
    id: "faq-incentive-bonus",
    question: "What is the level-based incentive bonus?",
    answer:
      "Higher savings levels have access to a larger target bonus, paid on top of your returned contribution. This is capped on purpose: it's strictly limited to what's actually available in the platform's accumulated fee revenue at that moment. If the pool is thin, the bonus is reduced or paused — we don't borrow against the future to pay it. It's described as 'up to' a rate, never a guaranteed extra return.",
  },
] as const;
