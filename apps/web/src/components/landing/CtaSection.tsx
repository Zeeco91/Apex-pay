import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function CtaSection() {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="rounded-3xl bg-primary px-8 py-16 text-center sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Ready to start saving?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-primary-foreground/80">
            Register with your phone number and join a savings level in
            minutes.
          </p>
          <div className="mt-8 flex justify-center">
            <ButtonLink
              href="/register"
              variant="secondary"
              className="px-8 py-3.5 text-base"
            >
              Get Started
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
