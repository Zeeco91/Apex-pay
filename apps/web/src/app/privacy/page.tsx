import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — APEX PAY",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <ComingSoon
        title="Privacy Policy"
        description="Our full Privacy Policy, covering how we handle your KYC and account data, will be published here before registration opens."
      />
      <Footer />
    </>
  );
}
