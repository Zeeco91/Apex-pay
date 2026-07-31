import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Contact Support · APEX PAY",
  description: "Reach the APEX PAY team on Telegram for updates or support.",
};

const TELEGRAM_LINKS = [
  {
    href: "https://t.me/apexpayorg",
    label: "Announcement Channel",
    description: "Official updates, launch announcements, and platform news.",
    cta: "Join channel",
  },
  {
    href: "https://t.me/apexpayoorg",
    label: "Community Group",
    description: "Chat with the team and other members, ask questions, and get help.",
    cta: "Join group",
  },
];

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="flex-1 py-16 sm:py-24">
        <Container className="max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Contact support
          </h1>
          <p className="mt-4 text-base leading-7 text-muted">
            We&apos;re on Telegram. Join whichever fits what you need.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {TELEGRAM_LINKS.map((link) => (
              <div
                key={link.href}
                className="flex flex-col items-center rounded-2xl border border-border bg-background p-6 text-center shadow-sm"
              >
                <TelegramIcon />
                <p className="mt-4 text-base font-semibold text-foreground">{link.label}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{link.description}</p>
                <ButtonLink
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                  className="mt-6 w-full"
                >
                  {link.cta}
                </ButtonLink>
              </div>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function TelegramIcon() {
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M21.94 3.61a1.5 1.5 0 0 0-1.55-.22L2.7 10.6a1.4 1.4 0 0 0 .1 2.63l4.55 1.5 1.75 5.63a1.3 1.3 0 0 0 2.16.5l2.4-2.3 4.47 3.3a1.5 1.5 0 0 0 2.37-.9l3.06-15.4a1.5 1.5 0 0 0-.62-1.45ZM9.4 14.4l-1.2 3.87-1.13-3.65 11.02-6.9c.2-.13.4.14.23.3L9.4 14.4Z" />
      </svg>
    </span>
  );
}
