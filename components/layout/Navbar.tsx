"use client";

import { useState } from "react";
import Image from "next/image";
import Container from "@/components/ui/Container";
import { ShoppingCart, Search, ChevronDown, Menu, X } from "lucide-react";

const navLinks = [
  { label: "NHS Services", href: "#nhs" },
  { label: "Private Services", href: "#services" },
  { label: "WhatsApp", href: "https://api.whatsapp.com/message/S3W272ZN4QM7O1?autoload=1&app_absent=0" },
  { label: "Help & Support", href: "#faq" }
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const cartCount = 0;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-16 items-center justify-between gap-3 md:h-20">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Pharmacy Express logo"
              width={150}
              height={40}
              className="h-8 w-auto md:h-9"
            />
          </a>

          {/* Search (desktop) */}
          <div className="hidden flex-1 items-center md:flex">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search for treatments e.g. weight loss, migraines"
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Desktop nav */}
            <nav className="hidden items-center gap-4 text-xs font-medium text-slate-700 lg:flex">
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="inline-flex items-center gap-1 transition hover:text-cyan-700"
                >
                  {item.label}
                  {item.label.includes("Services") && (
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  )}
                </a>
              ))}
            </nav>

            {/* Cart button */}
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-cyan-400 hover:text-cyan-700"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Login */}
            <button
              type="button"
              className="hidden rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 md:inline-block"
            >
              Log in
            </button>

            {/* Mobile menu */}
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-1.5 text-slate-700 md:hidden"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Search + nav mobile */}
        {open && (
          <div className="pb-4 md:hidden">
            <div className="mb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search for treatments"
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>
            <nav className="flex flex-col gap-1 rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-soft-card">
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="rounded-2xl px-2 py-2 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <button
                type="button"
                className="mt-2 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                onClick={() => setOpen(false)}
              >
                Log in
              </button>
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
}
