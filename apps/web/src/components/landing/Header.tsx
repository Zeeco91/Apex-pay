import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { NAV_LINKS, SITE_NAME } from "@/lib/constants";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-foreground"
          aria-label={`${SITE_NAME} home`}
        >
          {SITE_NAME.split(" ")[0]}
          <span className="text-primary"> {SITE_NAME.split(" ")[1]}</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <ButtonLink href="/login" variant="outline" className="hidden sm:inline-flex">
            Log In
          </ButtonLink>
          <ButtonLink href="/register" variant="primary">
            Get Started
          </ButtonLink>
        </div>
      </Container>
    </header>
  );
}
