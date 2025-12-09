// components/layout/Navbar.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Container from "@/components/ui/Container";
import { Search, ChevronDown, Menu, X, User, Package } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import CartButton from "@/components/cart/CartButton";
import type { DynamicNavbarContent } from "@/lib/api";
import { getBackendBase } from "@/lib/api"; // 👈 NEW

const DEFAULT_NAV_LINKS = [
  { label: "NHS Services", href: "#nhs" },
  { label: "Private Services", href: "#services" },
  {
    label: "WhatsApp",
    href: "https://api.whatsapp.com/message/S3W272ZN4QM7O1?autoload=1&app_absent=0",
    external: true,
  },
  { label: "Help & Support", href: "#faq" },
];

// 👇 helper to normalise backend/static image URLs
const resolveImageUrl = (imagePath?: string | null) => {
  if (!imagePath) return "";

  // already an absolute URL – return as is
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;

  // get backend base (e.g. https://tenant.domain/api) and strip /api
  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");

  return `${cleanBase}${normalizedPath}`;
};

type NavbarProps = {
  data?: DynamicNavbarContent | null;
};

export default function Navbar({ data }: NavbarProps) {
  const router = useRouter();
  const { user, clearAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

const handleLogout = () => {
  // clear your auth context/state
  clearAuth();

  // clear all browser storage
  if (typeof window !== "undefined") {
    try {
      window.localStorage.clear();      // 🔹 clears whole localStorage
      window.sessionStorage.clear();   // 🔹 optional, but usually useful
    } catch (err) {
      console.error("Failed to clear storage on logout", err);
    }
  }

  setAccountOpen(false);
  router.push("/");
};


  const userInitial = (
    user?.firstName?.[0] ||
    user?.lastName?.[0] ||
    user?.email?.[0] ||
    "U"
  ).toUpperCase();

  // 🔹 Dynamic bits with fallbacks
  const logoUrl = data?.logoUrl ?? "/logo.png";
  const logoAlt = data?.logoAlt ?? "Pharmacy Express logo";
  const searchPlaceholder =
    data?.searchPlaceholder ??
    "Search for treatments e.g. weight loss, migraines";

  const links =
    data?.navLinks && data.navLinks.length > 0
      ? data.navLinks
      : DEFAULT_NAV_LINKS;

  const isExternal = (href: string, external?: boolean) =>
    external || href.startsWith("http");

  // 🔹 Resolve logo through backend-aware helper
  const logoSrc = resolveImageUrl(logoUrl || "/logo.png");

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-16 items-center justify-between gap-3 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <Image
              src={logoSrc || "/logo.png"} // final fallback just in case
              alt={logoAlt}
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
                placeholder={searchPlaceholder}
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Desktop nav */}
            <nav className="hidden items-center gap-4 text-xs font-medium text-slate-700 lg:flex">
              {links.map((item) => {
                const external = isExternal(item.href, item.external);
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    className="inline-flex items-center gap-1 transition hover:text-cyan-700"
                  >
                    {item.label}
                    {item.label.includes("Services") && (
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    )}
                  </a>
                );
              })}
            </nav>

            {/* Cart button */}
            <CartButton />

            {/* Desktop account: login OR avatar */}
            {!user ? (
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="hidden rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 md:inline-block"
              >
                Log in
              </button>
            ) : (
              <div className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:border-cyan-400 hover:bg-cyan-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-white">
                    {userInitial}
                  </span>
                  <span className="hidden max-w-[120px] truncate sm:inline-block">
                    {user?.firstName || user?.email || "My account"}
                  </span>
                </button>

                {accountOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-2xl border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-soft-card">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        router.push("/profile");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                    >
                      <User className="h-4 w-4 text-slate-500" />
                      <span>My profile</span>
                    </button>
                                        <button
                      type="button"
                      onClick={() => {
                        setAccountOpen(false);
                        router.push("/profile?tab=orders");
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                    >
                      <Package className="h-4 w-4 text-slate-500" />
                      <span>My orders</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="mt-1 w-full rounded-xl px-2 py-2 text-left text-rose-600 hover:bg-rose-50"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Mobile menu button */}
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
                  placeholder={searchPlaceholder || "Search for treatments"}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </div>
            </div>
            <nav className="flex flex-col gap-1 rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-soft-card">
              {links.map((item) => {
                const external = isExternal(item.href, item.external);
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    className="rounded-2xl px-2 py-2 hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    {item.label}
                  </a>
                );
              })}

              {/* Mobile account actions */}
              {!user ? (
                <button
                  type="button"
                  className="mt-2 w-full rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  onClick={() => {
                    setOpen(false);
                    router.push("/login");
                  }}
                >
                  Log in
                </button>
              ) : (
                <div className="mt-3 flex flex-col gap-1 text-xs">
                  <button
                    type="button"
                    className="w-full rounded-2xl px-3 py-2 text-left hover:bg-slate-50"
                    onClick={() => {
                      setOpen(false);
                      router.push("/profile");
                    }}
                  >
                    My profile
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl px-3 py-2 text-left text-rose-600 hover:bg-rose-50"
                    onClick={() => {
                      setOpen(false);
                      handleLogout();
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
      </Container>
    </header>
  );
}
