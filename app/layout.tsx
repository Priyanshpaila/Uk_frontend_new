"use client";
import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CartProvider } from "@/components/cart/cart-context";
import { Toaster } from "react-hot-toast";
import { Suspense, useEffect, useState } from "react";
import {  fetchDynamicHomePage, type DynamicHomePageContent } from "@/lib/api";
import Head from "next/head"; // Import next/head for metadata updates

// Font setup
const inter = Inter({ subsets: ["latin"] });

// Hardcoded metadata (for SSR)


// Fallback icon handling if URL fails to build
// function safeBuildMediaUrl(path?: string | null, fallback: string = "/icon.png") {
//   if (!path || !String(path).trim()) return fallback;
//   try {
//     return buildMediaUrl(path);
//   } catch (e) {
//     console.error("Failed to build media url:", e);
//     return fallback;
//   }
// }

// Layout component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pageContent, setPageContent] = useState<DynamicHomePageContent | null>(
    null
  );
  const [loading, setLoading] = useState(true); // Add loading state

  // Fetch page content after a delay
  useEffect(() => {
    async function fetchContent() {
      try {
        const content = await fetchDynamicHomePage("home");
        setPageContent(content);
      } catch (error) {
        console.error("Error fetching dynamic content:", error);
      } finally {
        setLoading(false); // Set loading to false once content is fetched
      }
    }
    fetchContent();
  }, []); // Empty dependency array means this runs once on mount

  // If pageContent is still loading, show loading state
  if (loading || !pageContent) {
    return (
      <html lang="en">
        <body className={`${inter.className} min-h-screen bg-white flex flex-col`}>
          <div>Loading...</div> {/* Display loading state */}
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-white flex flex-col`}>
        {/* Hardcoded metadata in the <head> */}
     

        <AuthProvider>
          <CartProvider>
            <Suspense
              fallback={<div className="h-16 md:h-20 border-b border-slate-200 bg-white/80" />}
            >
              <Navbar data={pageContent?.navbar ?? pageContent?.content?.navbar} />
            </Suspense>

            <main className="flex-1">{children}</main>

            <Footer data={pageContent?.footer ?? pageContent?.content?.footer} />
            <Toaster position="top-right" />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
