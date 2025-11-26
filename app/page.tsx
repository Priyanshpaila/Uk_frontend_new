import Hero from "@/components/home/Hero";
import KeyBenefits from "@/components/home/KeyBenefits";
import ServicesSection from "@/components/home/ServicesSection";
import SafeSecureSection from "@/components/home/SafeSecureSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FAQSection from "@/components/home/FAQSection";
import ContactStrip from "@/components/home/ContactStrip";

export default function HomePage() {
  return (
    <>
      <Hero />
      <KeyBenefits />
      <ServicesSection />
      <SafeSecureSection />
      <TestimonialsSection />
      <FAQSection />
      <ContactStrip />
    </>
  );
}
