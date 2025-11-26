import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Pharmacy Express | Online Pharmacy UK",
  description:
    "A modern online pharmacy landing page with weight management, vaccination and private services."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-pharmacy-bg text-slate-900">
        <Providers>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
