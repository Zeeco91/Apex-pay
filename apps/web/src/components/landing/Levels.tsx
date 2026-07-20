import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LEVELS, formatNaira } from "@/lib/constants";

export function Levels() {
  return (
    <section id="levels" className="scroll-mt-20 bg-surface py-20 sm:py-28">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Choose your savings level
          </h2>
          <p className="mt-4 text-lg text-muted">
            Six contribution tiers. Join the level that fits your budget — you
            can only be in one active queue per level at a time.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {LEVELS.map((level) => (
            <div
              key={level.id}
              className="flex flex-col rounded-2xl border border-border bg-background p-6 shadow-sm"
            >
              <span className="text-sm font-semibold uppercase tracking-wide text-muted">
                {level.name}
              </span>
              <span className="mt-2 text-3xl font-bold text-primary">
                {formatNaira(level.amount)}
              </span>
              <ButtonLink
                href="/register"
                variant="primary"
                className="mt-6 w-full justify-center"
              >
                JOIN LEVEL
              </ButtonLink>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <ButtonLink href="/register" variant="primary">
            Join now
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
