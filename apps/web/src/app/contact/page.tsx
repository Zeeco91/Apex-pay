import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Contact Support — APEX PAY",
};

export default function ContactPage() {
  return (
    <>
      <Header />
      <ComingSoon
        title="Contact support"
        description="A dedicated support channel is coming soon. In the meantime, thanks for your patience while we build APEX PAY."
      />
      <Footer />
    </>
  );
}
