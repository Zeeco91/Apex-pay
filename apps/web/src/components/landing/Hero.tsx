import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function Hero() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 flex justify-center"
      >
        <div className="h-72 w-[36rem] rounded-full bg-primary/20 blur-3xl" />
      </div>

      <Container className="flex flex-col items-center text-center">
        <p className="mb-4 inline-flex items-center rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          A contribution-based savings queue
        </p>

        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
          Save together.{" "}
          <span className="text-primary">Get paid in turn.</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          APEX PAY organizes members into contribution queues by savings level —
          you get your investment back with returns when it&apos;s your turn, no
          guessing games.
        </p>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
          <ButtonLink href="/register" variant="primary" className="px-8 py-3.5 text-base">
            Get Started
          </ButtonLink>
          <ButtonLink href="#how-it-works" variant="outline" className="px-8 py-3.5 text-base">
            See How It Works
          </ButtonLink>
        </div>

        <p className="mt-8 max-w-xl text-sm text-muted">
          You always get a return on what you contribute.{" "}
          <a
            href="#faq-is-investment"
            className="font-medium text-primary underline underline-offset-4"
          >
            Read how we keep this honest →
          </a>
        </p>
      </Container>
    </section>
  );
}
