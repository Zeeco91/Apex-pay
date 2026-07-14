import type { Metadata } from "next";
import { Suspense } from "react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Container } from "@/components/ui/Container";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Register — APEX PAY",
  description: "Create your APEX PAY account with your phone number to join a savings level.",
};

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="flex-1 py-16 sm:py-24">
        <Container className="max-w-md">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Create your account
          </h1>
          <p className="mt-2 text-muted">
            Register with your phone number to get started.
          </p>
          <div className="mt-8">
            <Suspense fallback={null}>
              <RegisterForm />
            </Suspense>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
