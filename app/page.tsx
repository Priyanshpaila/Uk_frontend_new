// app/page.tsx (or wherever your HomePage lives)

import Hero from "@/components/home/Hero";
import KeyBenefits from "@/components/home/KeyBenefits";
import ServicesSection from "@/components/home/ServicesSection";
import SafeSecureSection from "@/components/home/SafeSecureSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FAQSection from "@/components/home/FAQSection";
import ContactStrip from "@/components/home/ContactStrip";

import { fetchDynamicHomePage, type DynamicHomePageContent } from "@/lib/api";
import { Suspense } from "react";

// ✅ Server component – can fetch data
export default async function HomePage() {
  let content: DynamicHomePageContent | null = null;

  try {
    // calls GET http://localhost:8000/api/dynamicHomePages/home
    content = await fetchDynamicHomePage("home");
  } catch (err) {
    console.error("Failed to load dynamic home page content:", err);
    // content stays null → components will use their own static defaults
  }

  return (
    <>
      {/* Each section gets its slice of content, but all props are optional */}
      <Hero data={content?.hero} />

      <KeyBenefits data={content?.keyBenefits} />

      {/* services are already dynamic from /services, so keep as-is */}
      <Suspense fallback={null}>
        <ServicesSection />
      </Suspense>

      <SafeSecureSection data={content?.safeSecure} />
      <TestimonialsSection data={content?.testimonials} />
      <FAQSection data={content?.faq} />
      <ContactStrip data={content?.contact} />
    </>
  );
}
