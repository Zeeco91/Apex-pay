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
};

export const LEVELS: Level[] = [
  { id: "level-1", name: "Bronze", amount: 5_000 },
  { id: "level-2", name: "Silver", amount: 10_000 },
  { id: "level-3", name: "Gold", amount: 20_000 },
  { id: "level-4", name: "Platinum", amount: 50_000 },
  { id: "level-5", name: "Diamond", amount: 100_000 },
  { id: "level-6", name: "Diamond Elite", amount: 200_000 },
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
      "APEX PAY is a contribution-based savings queue — you get your investment back plus a return, but there's no fixed or guaranteed rate of return like a traditional investment product would offer. What you get back is your full contribution plus a return.",
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
] as const;
