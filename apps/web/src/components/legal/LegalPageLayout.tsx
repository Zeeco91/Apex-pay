import type { ReactNode } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Container } from "@/components/ui/Container";

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 py-16 sm:py-24">
        <Container className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">Last updated: {lastUpdated}</p>

          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-foreground">
            <strong>Draft for pre-launch review.</strong> This document describes how APEX PAY is designed to
            operate. It is not legal advice, and it must be reviewed by qualified Nigerian legal counsel —
            including for CBN payment-service and NDPA data-protection compliance — before any real user funds
            are accepted.
          </div>

          <div className="mt-10 flex flex-col gap-10">{children}</div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground">{heading}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}
