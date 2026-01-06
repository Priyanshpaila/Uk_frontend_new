"use client";

import { Suspense, useEffect, useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CartProvider } from "@/components/cart/cart-context";
import { Toaster } from "react-hot-toast";
import {
  fetchDynamicHomePage,
  type DynamicHomePageContent,
} from "@/lib/api";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pageContent, setPageContent] =
    useState<DynamicHomePageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchContent() {
      try {
        const content = await fetchDynamicHomePage("home");
        setPageContent(content);
      } catch (e) {
        console.error("Error fetching dynamic content:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchContent();
  }, []);

  if (loading || !pageContent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <AuthProvider>
      <CartProvider>
        <Suspense
          fallback={<div className="border-b border-slate-200 bg-transparent" />}
        >
          <div className="sticky top-0 z-50 max-w-screen-xl mx-auto">
            <Navbar
              data={pageContent.navbar ?? pageContent.content?.navbar}
            />
          </div>
        </Suspense>

        <main className="flex-1 mt-[-110px]">
          {children}
        </main>

        <Footer
          data={pageContent.footer ?? pageContent.content?.footer}
        />
        <Toaster position="top-right" />
      </CartProvider>
    </AuthProvider>
  );
}
