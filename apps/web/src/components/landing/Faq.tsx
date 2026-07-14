"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/Container";
import { FAQ_ITEMS } from "@/lib/constants";

function openAndScrollToHash() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return;

  const target = document.getElementById(hash);
  if (target instanceof HTMLDetailsElement) {
    target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function Faq() {
  useEffect(() => {
    openAndScrollToHash();
    window.addEventListener("hashchange", openAndScrollToHash);
    return () => window.removeEventListener("hashchange", openAndScrollToHash);
  }, []);

  return (
    <section id="faq" className="scroll-mt-20 py-20 sm:py-28">
      <Container className="max-w-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-base text-muted">
            Tap a question to expand the answer.
          </p>
        </div>

        <div className="mt-12 divide-y divide-border rounded-2xl border border-border">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.id}
              id={item.id}
              className="group scroll-mt-24 p-6 open:bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-foreground marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                {item.question}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xl leading-none text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
