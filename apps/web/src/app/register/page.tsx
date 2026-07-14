import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Register — APEX PAY",
};

export default function RegisterPage() {
  return (
    <>
      <Header />
      <ComingSoon
        title="Registration opens soon"
        description="Phone-number registration is coming in the next build phase. Check back shortly to create your APEX PAY account."
      />
      <Footer />
    </>
  );
}
