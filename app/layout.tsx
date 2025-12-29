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
  buildMediaUrl, // ✅ use your existing helper
} from "@/lib/api";
import { Suspense, cache } from "react";

const inter = Inter({ subsets: ["latin"] });

export const revalidate = 60;

/** Fetch once (shared by generateMetadata + layout render) */
const getHomePage = cache(async () => {
  try {
    return (await fetchDynamicHomePage("home")) as DynamicHomePageContent;
  } catch (e) {
    console.error("Failed to fetch dynamic home page:", e);
    return null;
  }
});

/** Avoid any build/runtime issues if buildMediaUrl throws in SSR for some reason */
function safeBuildMediaUrl(path?: string | null, fallback: string = "/icon.png") {
  if (!path || !String(path).trim()) return fallback;
  try {
    return buildMediaUrl(path);
  } catch (e) {
    console.error("Failed to build media url:", e);
    return fallback;
  }
}

/** Dynamic metadata (title, description, favicon) from DB */
export async function generateMetadata(): Promise<Metadata> {
  const pageContent = await getHomePage();

  // Support both shapes: pageContent.navbar OR pageContent.content.navbar
  const navbar =
    (pageContent as any)?.navbar ?? (pageContent as any)?.content?.navbar;

  const favicon: string | undefined = navbar?.icon;
  const logoAlt: string | undefined = navbar?.logoAlt;

  // Your requirement: logoAlt as title
  const title =
    (logoAlt && String(logoAlt).trim()) ||
    (pageContent as any)?.title ||
    "Pharmacy Express - Online Pharmacy";

  const description =
    (pageContent as any)?.meta?.description ||
    (pageContent as any)?.description ||
    "Pharmacy landing site";

  // ✅ Full URL for favicon using your helper
  const icon = safeBuildMediaUrl(favicon, "/icon.png");

  let metadataBase: URL | undefined = undefined;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) {
    try {
      metadataBase = new URL(siteUrl);
    } catch {
      // ignore invalid env to avoid build issues
    }
  }

  return {
    metadataBase,
    title,
    description,
    icons: {
      icon,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pageContent = await getHomePage();

  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-white flex flex-col`}>
        <AuthProvider>
          <CartProvider>
            <Suspense
              fallback={
                <div className="h-16 md:h-20 border-b border-slate-200 bg-white/80" />
              }
            >
              <Navbar
                data={
                  (pageContent as any)?.navbar ??
                  (pageContent as any)?.content?.navbar
                }
              />
            </Suspense>

            <main className="flex-1">{children}</main>

            <Footer
              data={
                (pageContent as any)?.footer ??
                (pageContent as any)?.content?.footer
              }
            />
            <Toaster position="top-right" />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
