import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Terms of Service — APEX PAY",
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <ComingSoon
        title="Terms of Service"
        description="Our full Terms of Service, including queue-payout and fee details, will be published here before registration opens."
      />
      <Footer />
    </>
  );
}
