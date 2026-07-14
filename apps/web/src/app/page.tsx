import { CtaSection } from "@/components/landing/CtaSection";
import { Faq } from "@/components/landing/Faq";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Levels } from "@/components/landing/Levels";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Levels />
        <Faq />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
