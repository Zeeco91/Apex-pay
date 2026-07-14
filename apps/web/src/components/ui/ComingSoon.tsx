import Link from "next/link";
import { Container } from "@/components/ui/Container";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <main className="flex flex-1 items-center justify-center py-24">
      <Container className="max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Coming soon
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted">{description}</p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Back to home
        </Link>
      </Container>
    </main>
  );
}
