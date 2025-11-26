
"use client";

// --- Auth cookie + storage helpers (kept in sync with /auth page) ---
const __isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
function __setCookie(name: string, value: string, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Expires=${expires}; SameSite=Lax${__isHttps ? '; Secure' : ''}`;
}
function __clearCookie(name: string) {
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}
function __setAuthCookies(token?: string | null) {
  if (!token) {
    __clearCookie('auth_token');
    __clearCookie('token');
    __clearCookie('logged_in');
    return;
  }
  __setCookie('auth_token', token);
  __setCookie('token', token);
  __setCookie('logged_in', '1');
}
function __saveAuthToStorage(token?: string | null, user?: any) {
  try {
    if (token) localStorage.setItem('token', token);
    if (user) localStorage.setItem('user', JSON.stringify(user));
  } catch {}
}
function __announceAuthChange() {
  try {
    window.dispatchEvent(new CustomEvent('pe-auth-changed'));
  } catch {}
}


import { useEffect, useMemo, useState } from "react";

const NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;
const PHONE_CHARS_RE = /^[0-9 +()\-]+$/;
const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,}$/;

const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const keepPhoneChars = (s: string) => s.replace(/[^0-9 +()\-]/g, '');
const keepNameChars  = (s: string) => s.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ' -]/g, '');

type Mode = "login" | "register";

type LoginStepProps = {
  serviceSlug?: string; // optional; for analytics or redirect if you need it later
  allowSkip?: boolean;  // show a 'Skip' button (some flows don't require login)
  autoContinue?: boolean;
  onSuccess?: (user: any) => void;
  onSkip?: () => void;
};

type ApiError = { message?: string; errors?: Record<string, string[] | string> };

// Use Next.js API routes as a proxy to the backend so we don't leak the backend base URL here
const API_BASE = '';

/**
 * Normalize API validation errors into a simple string.
 */
function renderError(e: unknown): string {
  if (!e) return "Something went wrong.";
  if (typeof e === "string") return e;
  const obj = e as ApiError;
  if (obj.message) return obj.message;
  if (obj.errors) {
    const lines: string[] = [];
    for (const [k, v] of Object.entries(obj.errors)) {
      if (Array.isArray(v)) lines.push(`${k}: ${v.join(", ")}`);
      else lines.push(`${k}: ${v}`);
    }
    if (lines.length) return lines.join(" • ");
  }
  try {
    return JSON.stringify(e);
  } catch {
    return "Unexpected error.";
  }
}

export default function LoginStep({
  serviceSlug,
  allowSkip = true,
  autoContinue = true,
  onSuccess,
  onSkip,
}: LoginStepProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shouldAutoAdvance = Boolean(autoContinue && onSuccess);

  // Move the booking flow to the next step (RAF)
  function advanceToNext() {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("step", "raf");
      window.location.assign(url.toString());
    } catch {
      // fallback hard reload
      try { window.location.href = `${window.location.pathname}?step=raf`; } catch {}
    }
  }

  // Shared fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Register-only fields (extended)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [dobDay, setDobDay] = useState("");
  const [dobMonth, setDobMonth] = useState("");
  const [dobYear, setDobYear] = useState("");
  const [postcode, setPostcode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [marketing, setMarketing] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // UI helpers
  const [pwHelpVisible, setPwHelpVisible] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Address lookup state
  const [addrOptions, setAddrOptions] = useState<string[]>([]);
  const [addrSelected, setAddrSelected] = useState("");
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);

  function errCls(k: string) {
    return errors[k] ? "border-2 border-red-500" : "border border-gray-300";
  }

  // Simple session: bearer token stored in localStorage (adjust to your real auth)
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("auth_token") : null;

  // If token exists, try to fetch current user and offer "Continue"
  const [me, setMe] = useState<any | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(!!token);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!token) return;
      setCheckingSession(true);
      try {
        const res = await fetch(`/api/me`, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
        if (!res.ok) throw await res.json().catch(() => ({}));
        const data = await res.json();
        if (!cancelled) {
          const userObj = data?.user ?? data;
          // persist token/cookies for header SSR and client widgets
          try {
            const tokenNow = (typeof window !== 'undefined' && localStorage.getItem('auth_token')) || '';
            __saveAuthToStorage(tokenNow, userObj || undefined);
            __setAuthCookies(tokenNow);
            __announceAuthChange();
          } catch {}
          if (shouldAutoAdvance) {
            onSuccess?.(userObj);
          } else {
            // Auto-advance to the next booking step if we already have a session
            advanceToNext();
            return;
          }
        }
      } catch {
        // token invalid — clear it silently
        if (!cancelled && typeof window !== "undefined") {
          window.localStorage.removeItem("auth_token");
        }
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const heading = useMemo(() => {
    if (checkingSession) return "Checking your session…";
    if (me) return `Welcome back${me.first_name ? ", " + me.first_name : ""}!`;
    return mode === "login" ? "Log in to continue" : "Create an account";
  }, [mode, me, checkingSession]);

  function validateRegister(): boolean {
    const e: Record<string, string> = {};

    // Requireds
    const req: Array<[string, string, string]> = [
      ["firstName", firstName, "First name"],
      ["lastName",  lastName,  "Last name"],
      ["gender",    gender,    "Gender"],
      ["phone",     phone,     "Contact no"],
      ["dob",       `${dobYear}-${dobMonth}-${dobDay}`, "Date of birth"],
      ["email",     email,     "Email"],
      ["password",  password,  "Password"],
      ["postcode",  postcode,  "Postcode/ZIP"],
      ["address1",  address1,  "Address 1"],
      ["city",      city,      "City"],
      ["country",   country,   "Country"],
    ];
    for (const [k, v, label] of req) {
      if (!String(v || "").trim()) e[k] = `${label} is required`;
    }

    // Names
    if (firstName && !NAME_RE.test(firstName)) e.firstName = "Use letters (space, apostrophe, hyphen allowed)";
    if (lastName  && !NAME_RE.test(lastName))  e.lastName  = "Use letters (space, apostrophe, hyphen allowed)";

    // Phone
    const phoneSan = phone.trim();
    if (phoneSan && !PHONE_CHARS_RE.test(phoneSan)) e.phone = "Use digits and + ( ) - only";
    const phoneDigits = (phoneSan.match(/\d/g) ?? []).length;
    if (!e.phone && phoneDigits < 7) e.phone = "Enter a valid phone number";

    // Email
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";

    // Password
    if (password && !PW_RE.test(password))
      e.password = "Password must be 10+ chars, include upper, lower, number, special";

    // DOB numeric + basic ranges
    const d = Number(dobDay), m = Number(dobMonth), y = Number(dobYear);
    const numericDob = /^\d+$/.test(dobDay) && /^\d+$/.test(dobMonth) && /^\d+$/.test(dobYear);
    const dateOk = numericDob && d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100;
    if (!dateOk) e.dob = "Enter a valid date of birth";

    if (!acceptTerms) e.terms = "You must accept the terms";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function findAddress() {
    const pc = postcode.trim();
    if (!pc) {
      setErrors((e) => ({ ...e, postcode: "Postcode/ZIP is required" }));
      return;
    }
    setLoadingAddr(true);
    try {
      const res = await fetch(`/api/postcode?postcode=${encodeURIComponent(pc)}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.addresses) || data.addresses.length === 0) {
        setAddrOptions([]);
        setAddrSelected("");
        setErrors((e) => ({ ...e, postcode: "No addresses found for this postcode" }));
        return;
      }
      setAddrOptions(data.addresses);
      setAddrSelected("");
      setShowManualAddress(false);
      setErrors((e) => {
        const { postcode, ...rest } = e;
        return rest;
      });
    } catch {
      setErrors((e) => ({ ...e, postcode: "Could not search address right now" }));
    } finally {
      setLoadingAddr(false);
    }
  }

  function clearAddress() {
    setAddrOptions([]);
    setAddrSelected("");
    setAddress1("");
    setAddress2("");
    setCity("");
  }

  function applySelectedAddress(v: string) {
    setAddrSelected(v);
    const parts = v.split(",").map((s) => s.trim()).filter(Boolean);
    const cityGuess = parts.length >= 2 ? parts[parts.length - 2] : parts[parts.length - 1] ?? "";
    const line1 = parts.slice(0, parts.length - 2).join(", ") || parts[0] || "";
    setAddress1(line1);
    setCity(cityGuess);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        throw await res.json().catch(() => ({ message: "Login failed." }));
      }
      const data = await res.json();
      const newToken = data?.token || data?.access_token || null;
      const user = data?.user || data;
      if (typeof window !== "undefined" && newToken) {
        window.localStorage.setItem("auth_token", String(newToken));
      }
      // mirror to cookies + broadcast so header updates immediately
      __saveAuthToStorage(newToken ?? null, user || undefined);
      __setAuthCookies(newToken ?? null);
      __announceAuthChange();
      if (shouldAutoAdvance) {
        onSuccess?.(user);
      } else {
        advanceToNext();
        return;
      }
    } catch (err) {
      setError(renderError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Local validate with richer rules
    if (!validateRegister()) {
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        email,
        password,
        firstName: firstName,
        lastName: lastName,
        gender,
        phone,
        dob: `${dobYear}-${dobMonth.padStart(2, "0")}-${dobDay.padStart(2, "0")}`,
        postcode,
        address1,
        address2,
        city,
        country,
        marketing,
        terms: acceptTerms ? 1 : 0,
      };
      const res = await fetch(`/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw await res.json().catch(() => ({ message: "Registration failed." }));
      }
      const data = await res.json();
      const newToken = data?.token || data?.access_token || null;
      const user = data?.user || data;
      if (typeof window !== "undefined" && newToken) {
        window.localStorage.setItem("auth_token", String(newToken));
      }
      __saveAuthToStorage(newToken ?? null, user || undefined);
      __setAuthCookies(newToken ?? null);
      __announceAuthChange();
      if (shouldAutoAdvance) {
        onSuccess?.(user);
      } else {
        advanceToNext();
        return;
      }
    } catch (err) {
      setError(renderError(err));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <div className="max-w-xl mx-auto w-full">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-700">{heading}</p>
        </div>
      </div>
    );
  }

  if (me && !shouldAutoAdvance) {
    // If we somehow get here, still move on.
    advanceToNext();
    return null;
  }

  return (
    <div className="max-w-xl mx-auto w-full">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">{heading}</h2>
          {allowSkip && (
            <button
              onClick={() => onSkip?.()}
              className="text-sm text-gray-600 hover:text-gray-900 underline underline-offset-4"
            >
              Skip for now
            </button>
          )}
        </div>


        {mode === "login" ? (
          <form onSubmit={handleLogin} className="grid gap-4">
            <label className="grid gap-1">
              <span className="text-sm text-gray-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-sm text-gray-700">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </label>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-emerald-600 text-white px-6 py-2 hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? "Signing in…" : "Sign in"}
              </button>

              <button
                type="button"
                onClick={() => setMode("register")}
                className="text-sm text-emerald-700 hover:underline"
              >
                Create an account
              </button>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleRegister} className="grid gap-4">
            {/* Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="grid gap-1">
                <span className="text-sm text-gray-700">First name</span>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(keepNameChars(e.target.value))}
                  className={`rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errCls("firstName")}`}
                />
                {errors.firstName && <span className="text-xs text-red-600">{errors.firstName}</span>}
              </label>
              <label className="grid gap-1">
                <span className="text-sm text-gray-700">Last name</span>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(keepNameChars(e.target.value))}
                  className={`rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errCls("lastName")}`}
                />
                {errors.lastName && <span className="text-xs text-red-600">{errors.lastName}</span>}
              </label>
            </div>

            {/* Gender & phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="grid gap-1">
                <span className="text-sm text-gray-700">Gender</span>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={`rounded-xl px-4 py-2 ${errCls("gender")}`}
                >
                  <option value="">Select your gender</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                  <option>Prefer not to say</option>
                </select>
                {errors.gender && <span className="text-xs text-red-600">{errors.gender}</span>}
              </label>

              <label className="grid gap-1">
                <span className="text-sm text-gray-700">Contact no</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(keepPhoneChars(e.target.value))}
                  className={`rounded-xl px-4 py-2 ${errCls("phone")}`}
                  inputMode="tel"
                  pattern="[0-9 +()\-]+"
                />
                {errors.phone && <span className="text-xs text-red-600">{errors.phone}</span>}
              </label>
            </div>

            {/* DOB */}
            <div className="grid gap-1">
              <span className="text-sm text-gray-700">Date of birth</span>
              <div className="grid grid-cols-3 gap-3">
                <input
                  placeholder="DD"
                  value={dobDay}
                  onChange={(e) => setDobDay(onlyDigits(e.target.value).slice(0,2))}
                  className={`rounded-xl px-4 py-2 ${errCls("dob")}`}
                  inputMode="numeric"
                />
                <input
                  placeholder="MM"
                  value={dobMonth}
                  onChange={(e) => setDobMonth(onlyDigits(e.target.value).slice(0,2))}
                  className={`rounded-xl px-4 py-2 ${errCls("dob")}`}
                  inputMode="numeric"
                />
                <input
                  placeholder="YYYY"
                  value={dobYear}
                  onChange={(e) => setDobYear(onlyDigits(e.target.value).slice(0,4))}
                  className={`rounded-xl px-4 py-2 ${errCls("dob")}`}
                  inputMode="numeric"
                />
              </div>
              {errors.dob && <span className="text-xs text-red-600">{errors.dob}</span>}
            </div>

            {/* Email */}
            <label className="grid gap-1">
              <span className="text-sm text-gray-700">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errCls("email")}`}
              />
              {errors.email && <span className="text-xs text-red-600">{errors.email}</span>}
            </label>

            {/* Password + live checklist */}
            <label className="grid gap-1">
              <span className="text-sm text-gray-700">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwHelpVisible(true); }}
                onFocus={() => setPwHelpVisible(true)}
                onBlur={() => setPwHelpVisible(Boolean(password))}
                className={`rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${errCls("password")}`}
                autoComplete="new-password"
              />
              {pwHelpVisible && (
                <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
                  <ul className="space-y-1">
                    <li className={/[A-Z]/.test(password) ? "text-green-600" : "text-gray-600"}>• At least one uppercase letter</li>
                    <li className={/[a-z]/.test(password) ? "text-green-600" : "text-gray-600"}>• At least one lowercase letter</li>
                    <li className={/\d/.test(password) ? "text-green-600" : "text-gray-600"}>• At least one number</li>
                    <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-600" : "text-gray-600"}>• At least one special character</li>
                    <li className={password.length >= 10 ? "text-green-600" : "text-gray-600"}>• Minimum 10 characters</li>
                  </ul>
                </div>
              )}
              {errors.password && <span className="text-xs text-red-600">{errors.password}</span>}
            </label>

            {/* Address header + postcode lookup */}
            <div className="grid gap-2">
              <span className="text-sm font-medium text-gray-700">Your address</span>

              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <input
                  placeholder="Postcode or ZIP"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className={`rounded-xl px-4 py-2 ${errCls("postcode")}`}
                />
                <button
                  type="button"
                  onClick={findAddress}
                  disabled={loadingAddr}
                  className="px-4 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {loadingAddr ? "Searching…" : "Find Address"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowManualAddress((v) => !v); setAddrOptions([]); setAddrSelected(""); }}
                  className="px-3 rounded-xl border border-gray-300 hover:bg-gray-50"
                >
                  {showManualAddress ? "Use lookup" : "Manually"}
                </button>
              </div>
              {errors.postcode && <span className="text-xs text-red-600">{errors.postcode}</span>}

              {addrOptions.length > 0 && !showManualAddress && (
                <div className="mb-2">
                  <label className="block mb-1 text-xs">Please select*</label>
                  <select
                    value={addrSelected}
                    onChange={(e) => applySelectedAddress(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2"
                    size={Math.min(8, addrOptions.length)}
                  >
                    {addrOptions.map((opt, i) => (
                      <option key={i} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button type="button" onClick={clearAddress} className="text-xs underline mt-1">Clear</button>
                </div>
              )}

              <input
                placeholder="Address 1"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
                className={`rounded-xl px-4 py-2 ${errCls("address1")}`}
              />
              <input
                placeholder="Address 2 (optional)"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
                className="rounded-xl border border-gray-300 px-4 py-2"
              />
              <input
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={`rounded-xl px-4 py-2 ${errCls("city")}`}
              />
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className={`rounded-xl px-4 py-2 ${errCls("country")}`}
              >
                <option value="">Select country</option>
                <option>United Kingdom</option>
              </select>
              {errors.country && <span className="text-xs text-red-600">{errors.country}</span>}
            </div>

            {/* Consents */}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
              I would like to be sent special offers and discount codes
            </label>
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                I confirm I have read and accept the terms and conditions of service
              </label>
              {errors.terms && <span className="text-xs text-red-600">{errors.terms}</span>}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-emerald-600 text-white px-6 py-2 hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading ? "Creating account…" : "Create account"}
              </button>

              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-emerald-700 hover:underline"
              >
                I already have an account
              </button>
            </div>
            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {error}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}