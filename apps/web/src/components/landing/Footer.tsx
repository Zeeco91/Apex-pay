import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/constants";

const FOOTER_LINKS = {
  Product: [
    { label: "How It Works", href: "#how-it-works" },
    { label: "Levels", href: "#levels" },
    { label: "Referrals", href: "#faq-referral-program" },
    { label: "FAQ", href: "#faq" },
  ],
  Legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Risk Disclosure", href: "#faq-is-investment" },
  ],
  Company: [
    { label: "Contact Support", href: "/contact" },
  ],
};

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <Container className="py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              {SITE_NAME}
            </span>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
              A transparent, contribution-based savings queue. You always get
              back what you put in.
            </p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-border pt-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {SITE_NAME}. All rights reserved.</p>
          <p className="max-w-xl">
            APEX PAY is a peer-funded savings queue, not a bank, and not an
            investment or securities product. Payout timing is estimated, not
            guaranteed.
          </p>
        </div>
      </Container>
    </footer>
  );
}
