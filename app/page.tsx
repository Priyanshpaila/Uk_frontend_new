"use client"; 

import Hero from "@/components/home/Hero";
import KeyBenefits from "@/components/home/KeyBenefits";
import ServicesSection from "@/components/home/ServicesSection";
import SafeSecureSection from "@/components/home/SafeSecureSection";
import TestimonialsSection from "@/components/home/TestimonialsSection";
import FAQSection from "@/components/home/FAQSection";
import ContactStrip from "@/components/home/ContactStrip";
import { fetchDynamicHomePage, type DynamicHomePageContent } from "@/lib/api";
import { Suspense, useState, useEffect } from "react";

// Client-side version to fetch data dynamically
const fetchContent = async () => {
  try {
    const data = await fetchDynamicHomePage("home");
    return data;
  } catch (error) {
    console.error("Failed to fetch dynamic home page content", error);
    return null;
  }
};

export default function HomePage() {
  const [content, setContent] = useState<DynamicHomePageContent | null>(null);
  const [loading, setLoading] = useState(true); // Add loading state

  useEffect(() => {
    const handleClientSideFetch = () => {
      if (typeof window !== "undefined") {
        // Delay to ensure the page has loaded
        setTimeout(async () => {
          try {
            const data = await fetchContent();
            setContent(data);
          } catch (error) {
            console.error("Failed to fetch dynamic home page content", error);
          } finally {
            setLoading(false); // Set loading to false after fetching
          }
        }, 0); // Optional delay (500ms)
      }
    };

    handleClientSideFetch();
  }, []);

  // If content is still loading, display a loading message
  if (loading) {
    return <div>Loading content...</div>;
  }

  return (
    <>
      <Hero data={content?.hero} />
      <KeyBenefits data={content?.keyBenefits} />
      <Suspense fallback={<div>Loading services...</div>}>
        <ServicesSection />
      </Suspense>
      <SafeSecureSection data={content?.safeSecure} />
      <TestimonialsSection data={content?.testimonials} />
      <FAQSection data={content?.faq} />
      <ContactStrip data={content?.contact} />
    </>
  );
}
