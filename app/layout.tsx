import "./globals.css";
import { Inter } from "next/font/google";
import ClientLayout from "@/app/providers/ClientLayout";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Netherton Chemist",
  description: "Pharmacy",
  icons: {
    icon: "/1.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} min-h-screen bg-transparent flex flex-col`}
      >
        <ClientLayout>
          {children}
        </ClientLayout>
      </body>
    </html>
  );
}
