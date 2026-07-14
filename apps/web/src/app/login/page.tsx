import type { Metadata } from "next";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Container } from "@/components/ui/Container";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log In — APEX PAY",
  description: "Log in to your APEX PAY account with your phone number and PIN.",
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="flex-1 py-16 sm:py-24">
        <Container className="max-w-md">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 text-muted">Log in with your phone number and PIN.</p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
