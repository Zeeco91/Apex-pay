import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Log In — APEX PAY",
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <ComingSoon
        title="Login opens soon"
        description="Secure phone-number login is coming in the next build phase."
      />
      <Footer />
    </>
  );
}
