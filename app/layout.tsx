// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { CartProvider } from "@/components/cart/cart-context";
import { Toaster } from "react-hot-toast";

import {
  fetchDynamicHomePage,
  type DynamicHomePageContent,
} from "@/lib/api";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pharmacy Express - Online Pharmacy ",
  description: "Pharmacy landing site",
  icons: {
    icon: "/icon.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let pageContent: DynamicHomePageContent | null = null;

  try {
    pageContent = await fetchDynamicHomePage("home");
  } catch (e) {
    console.error("Failed to fetch dynamic home page:", e);
  }

  return (
    <html lang="en">
      <body
        className={`${inter.className} min-h-screen bg-white flex flex-col`}
      >
        <AuthProvider>
          <CartProvider>
            {/* pass navbar + footer content down */}
            <Navbar data={pageContent?.navbar} />
            <main className="flex-1">{children}</main>
            <Footer data={pageContent?.footer} />
            <Toaster position="top-right" />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
