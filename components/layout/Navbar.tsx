"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import Container from "@/components/ui/Container";
import { Search, Menu, X, User, Package } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import CartButton from "@/components/cart/CartButton";
import type { DynamicNavbarContent } from "@/lib/api";
import { getBackendBase } from "@/lib/api";

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

// SSR-safe base: do NOT call getBackendBase() during SSR render.
function resolveImageUrlSSR(imagePath?: string | null) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return normalizedPath; // ✅ stable on server + first client render
}

// client-only upgrade (uses getBackendBase)
function resolveImageUrlClient(imagePath?: string | null) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  console.log("Resolving image URL for path:", normalizedPath);

  try {
    const baseWithApi = getBackendBase();
    const cleanBase = baseWithApi.replace(/\/api\/?$/, "");
    console.log("Base URL for media:", `${cleanBase}${normalizedPath}`);
    return `${cleanBase}${normalizedPath}`;
  } catch {
    return normalizedPath;
  }
}

type NavbarProps = {
  data?: DynamicNavbarContent | null;
};

export default function Navbar({ data }: NavbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, clearAuth } = useAuth();

  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // ✅ Hydration guard to avoid SSR/client auth mismatch
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // -----------------------------
  // Search state (mapped to URL)
  // -----------------------------
  const qParam = (searchParams.get("q") ?? "").toString();
  const [searchValue, setSearchValue] = useState<string>(qParam);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setSearchValue(qParam);
  }, [qParam]);

  const buildSearchHref = useCallback(
    (raw: string) => {
      const v = raw.trim();
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (v) params.set("q", v);
      else params.delete("q");
      const qs = params.toString();
      return qs ? `/?${qs}#services` : `/#services`;
    },
    [searchParams]
  );

  const scheduleReplace = useCallback(
    (raw: string) => {
      if (typeof window === "undefined") return;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        router.replace(buildSearchHref(raw));
      }, 250);
    },
    [buildSearchHref, router]
  );

  const onSearchChange = (next: string) => {
    setSearchValue(next);
    scheduleReplace(next);
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildSearchHref(searchValue));
    setOpen(false);
  };

  const handleLogout = () => {
    clearAuth();

    if (typeof window !== "undefined") {
      try {
        window.localStorage.clear();
        window.sessionStorage.clear();
      } catch (err) {
        console.error("Failed to clear storage on logout", err);
      }
    }

    setAccountOpen(false);
    router.push("/");
  };

  // Dynamic bits with fallbacks
  const logoUrl = data?.logoUrl ?? "";
  const logoAlt = data?.logoAlt ?? "Pharmacy Express logo";
  const searchPlaceholder =
    data?.searchPlaceholder ??
    "Search for treatments e.g. weight loss, migraines";

  const links =
    data?.navLinks && data.navLinks.length > 0 ? data.navLinks : DEFAULT_NAV_LINKS;

  const isExternal = (href: string, external?: boolean) =>
    external || href.startsWith("http");

  // ✅ SSR-stable logo first, then upgrade after hydration
  const logoSrcSSR = useMemo(() => resolveImageUrlClient(logoUrl || ""), [logoUrl]);
  console.log("Navbar logoSrcSSR:", logoSrcSSR);
  const [logoSrc, setLogoSrc] = useState<string>(logoSrcSSR);

  useEffect(() => {
    // keep SSR-stable immediately
    setLogoSrc(logoSrcSSR);
    console.log("Navbar logoSrc:", logoSrc);
    // then upgrade to backend-aware absolute URL (client-only)
    const upgraded = resolveImageUrlClient(logoUrl || "");
    setLogoSrc(upgraded);
  }, [logoUrl, logoSrcSSR]);

  // ✅ IMPORTANT: prevent SSR/client mismatch for user UI
  const effectiveUser = hydrated ? user : null;

  const userInitial = (
    effectiveUser?.firstName?.[0] ||
    effectiveUser?.lastName?.[0] ||
    effectiveUser?.email?.[0] ||
    "U"
  ).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
      <Container>
        <div className="flex h-16 items-center justify-between gap-3 md:h-20">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2">
            <Image
              src={logoSrc || "/logo.png"}
              
              alt={logoAlt}
              width={150}
              height={40}
              className="h-8 w-auto md:h-9"
              priority
            />
          </a>

          {/* Search (desktop) */}
          <div className="hidden flex-1 items-center md:flex">
            <form onSubmit={onSearchSubmit} className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
              />
            </form>
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
                  </a>
                );
              })}
            </nav>

            {/* Cart button (safe: CartButton already guards sheet/badge) */}
            <CartButton />

            {/* Desktop account: SSR-stable (shows Log in until hydrated) */}
            {!effectiveUser ? (
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
                    {effectiveUser?.firstName || effectiveUser?.email || "My account"}
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
              <form onSubmit={onSearchSubmit} className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder || "Search for treatments"}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-800 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              </form>
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

              {/* Mobile account actions (SSR-stable via effectiveUser) */}
              {!effectiveUser ? (
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
