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
  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;
  return normalizedPath;
}

// client-only upgrade (uses getBackendBase)
function resolveImageUrlClient(imagePath?: string | null) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  try {
    const baseWithApi = getBackendBase();
    const cleanBase = baseWithApi.replace(/\/api\/?$/, "");
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
  const searchPlaceholder = data?.searchPlaceholder ?? "Search";

  const links =
    data?.navLinks && data.navLinks.length > 0
      ? data.navLinks
      : DEFAULT_NAV_LINKS;

  const isExternal = (href: string, external?: boolean) =>
    external || href.startsWith("http");

  // ✅ SSR-stable logo first, then upgrade after hydration
  const logoSrcSSR = useMemo(
    () => resolveImageUrlClient(logoUrl || ""),
    [logoUrl]
  );
  const [logoSrc, setLogoSrc] = useState<string>(logoSrcSSR);

  useEffect(() => {
    setLogoSrc(logoSrcSSR);
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

  // -----------------------------
  // Desktop expanding search UI
  // -----------------------------
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // If there is already a query in URL, keep expanded so user can see/edit it.
  useEffect(() => {
    if ((qParam ?? "").trim()) setSearchExpanded(true);
  }, [qParam]);

  const openSearch = useCallback(() => {
    setSearchExpanded(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, []);

  const maybeCloseSearch = useCallback(() => {
    // close only if empty
    if (!searchValue.trim()) setSearchExpanded(false);
  }, [searchValue]);

  return (
    <header className="sticky top-0 z-40 py-3 bg-transparent">
      <Container>
        <div className="flex items-center justify-evenly gap-3 md:h-20 py-1 px-14 bg-white/60 shadow-2xl rounded-full max-w-screen-xl mx-auto backdrop-blur-2xl border border-transparent">
          {/* Logo */}
          <a href="/" className="flex items-center gap-1">
            <Image
              src={logoSrc || "/logo.png"}
              alt={logoAlt}
              width={150}
              height={40}
              className="h-8 w-auto md:h-9"
              priority
            />
          </a>

          {/* Search (desktop) — icon-only, expands on click/focus */}
          <div className="hidden flex-1 items-center md:flex">
            <div
              ref={searchWrapRef}
              className="w-full flex items-center"
              onMouseDown={() => {
                // Clicking anywhere in the pill opens it (but do not steal focus from input).
                if (!searchExpanded) openSearch();
              }}
              onBlurCapture={() => {
                // Close only when focus leaves this search pill.
                window.setTimeout(() => {
                  const active = document.activeElement;
                  const within = searchWrapRef.current?.contains(active);
                  if (!within) maybeCloseSearch();
                }, 0);
              }}
            >
              <form
                onSubmit={onSearchSubmit}
                className={[
                  "relative flex items-center overflow-hidden rounded-full border border-slate-200 bg-white/80 shadow-sm backdrop-blur",
                  "transition-[width,box-shadow,border-color] duration-300 ease-out",
                  "focus-within:border-cyan-300 focus-within:ring-2 focus-within:ring-cyan-200",
                  searchExpanded ? "w-full max-w-xl" : "w-11",
                ].join(" ")}
              >
                {/* Icon button */}
                <button
                  type="button"
                  aria-label="Search"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!searchExpanded) openSearch();
                    else searchInputRef.current?.focus();
                  }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-50"
                >
                  <Search className="h-4 w-4 text-slate-500" />
                </button>

                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      (e.currentTarget as HTMLInputElement).blur();
                      if (!searchValue.trim()) setSearchExpanded(false);
                    }
                  }}
                  placeholder={searchPlaceholder || "Search"}
                  className={[
                    "h-10 w-full bg-transparent py-2 pl-12 pr pr-4 text-xs text-slate-800 placeholder:text-slate-400",
                    "outline-none",
                    "transition-[opacity,transform] duration-200 ease-out",
                    searchExpanded
                      ? "opacity-100 translate-x-0"
                      : "opacity-0 -translate-x-1 pointer-events-none",
                  ].join(" ")}
                />
              </form>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Desktop nav */}
            <nav className="hidden items-center gap-4 text-xs font-medium text-slate-800 lg:flex">
              {links.map((item) => {
                const external = isExternal(item.href, item.external);
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    className="inline-flex items-center gap-1 rounded-full border-2 border-transparent px-3 py-2 transition hover:text-cyan-400"
                  >
                    {item.label}
                  </a>
                );
              })}
            </nav>

            {/* Cart button */}
            <CartButton />

            {/* Desktop account */}
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
                    {effectiveUser?.firstName ||
                      effectiveUser?.email ||
                      "My account"}
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

        {/* Mobile search + nav */}
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

              {/* Mobile account actions */}
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
