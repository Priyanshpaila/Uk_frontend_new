// app/private-services/[slug]/book/steps/LoginStep.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loginApi,
  registerPatientApi,
  getLoggedInUserApi,
  type LoginPayload,
  type LoginResponse,
  type RegisterPatientPayload,
  type LoggedInUser,
} from "@/lib/api";
import { useAuth } from "@/components/auth/AuthProvider";

type Mode = "login" | "register";

type LoginStepProps = {
  serviceSlug?: string;
  allowSkip?: boolean;
  autoContinue?: boolean;
  onSuccess?: (user: LoggedInUser | any) => void;
  onSkip?: () => void;
};

export default function LoginStep({
  serviceSlug,
  allowSkip = true,
  autoContinue = true,
  onSuccess,
  onSkip,
}: LoginStepProps) {
  const { setAuth } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // same idea as your login page – if we have a user already, we can skip
  const [checkingSession, setCheckingSession] = useState(true);
  const [me, setMe] = useState<LoggedInUser | null>(null);

  const shouldAutoAdvance = Boolean(autoContinue && onSuccess);

  function advanceToNext() {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("step", "raf");
      window.location.assign(url.toString());
    } catch {
      try {
        window.location.href = `${window.location.pathname}?step=raf`;
      } catch {
        // ignore
      }
    }
  }

  // ------------------ session check (already logged in?) ------------------ //

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (typeof window === "undefined") {
        setCheckingSession(false);
        return;
      }

      // mirror getAuthHeader token detection
      const ls = window.localStorage;
      const token =
        ls.getItem("session_token") ||
        ls.getItem("pharmacy_token") ||
        ls.getItem("pe_token") ||
        ls.getItem("token");

      if (!token) {
        setCheckingSession(false);
        return;
      }

      try {
        setCheckingSession(true);
        const user = await getLoggedInUserApi();

        if (cancelled) return;

        setMe(user);
        // sync with global auth (same as /login page)
        setAuth(user, token);

        if (shouldAutoAdvance) {
          onSuccess?.(user);
        } else {
          advanceToNext();
          return;
        }
      } catch {
        // invalid token – ignore and show login form
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------- login form state ---------------------- //

  const [loginForm, setLoginForm] = useState<LoginPayload>({
    email: "",
    password: "",
  });

  const handleLoginChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setLoginForm((prev) => ({ ...prev, [name]: value }));
  };

  // ---------------------- register form state ---------------------- //

  const [registerForm, setRegisterForm] =
    useState<RegisterPatientPayload>({
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      gender: "male",
      phone: "",
      dob: "",
      address_line1: "",
      address_line2: "",
      city: "",
      county: "",
      postalcode: "",
      country: "UK",
    });

  const handleRegisterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setRegisterForm((prev) => ({ ...prev, [name]: value }));
  };

  // ---------------------- submit handlers ---------------------- //

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res: LoginResponse | any = await loginApi(loginForm);

      const token: string =
        res.session_token ||
        res.token ||
        res.access_token ||
        "";

      const user = res.user ?? res;

      if (!token) {
        throw new Error("Login succeeded but no session token returned.");
      }

      // same behaviour as /login page
      setAuth(user, token);

      if (shouldAutoAdvance) {
        onSuccess?.(user);
      } else {
        advanceToNext();
      }
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res: any = await registerPatientApi(registerForm);

      // In case backend returns token + user directly on register:
      const token: string =
        res?.session_token ||
        res?.token ||
        res?.access_token ||
        "";

      const user = res?.user ?? res;

      if (token) {
        // Auto-login if token is present
        setAuth(user, token);

        if (shouldAutoAdvance) {
          onSuccess?.(user);
        } else {
          advanceToNext();
        }
      } else {
        // If no token, behave like your RegisterPage: ask user to log in
        setMode("login");
        setLoginForm((prev) => ({
          ...prev,
          email: registerForm.email,
        }));
        setError(
          "Account created successfully. Please log in to continue."
        );
      }
    } catch (err: any) {
      setError(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------- UI text -------------------------- //

  const heading = useMemo(() => {
    if (checkingSession) return "Checking your session…";
    if (me)
      return `Welcome back${
        me.firstName ? `, ${me.firstName}` : ""
      }`;
    return mode === "login"
      ? "Log in to continue"
      : "Create your account";
  }, [checkingSession, me, mode]);

  const subheading = useMemo(() => {
    if (checkingSession) return "Please wait a moment.";
    if (mode === "login") {
      return serviceSlug
        ? `Log in to book your ${serviceSlug} treatment with Pharmacy Express.`
        : "Manage your profile, view your orders and quickly reorder treatments.";
    }
    return "Securely manage your treatments, appointments and orders in one place.";
  }, [mode, checkingSession, serviceSlug]);

  // -------------------------- render -------------------------- //

  if (checkingSession) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft-card md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
             Your account
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
            {heading}
          </h2>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">
            {subheading}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft-card md:p-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
               Your account
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
              {heading}
            </h2>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              {subheading}
            </p>
          </div>
          {allowSkip && (
            <button
              type="button"
              onClick={() => {
                if (onSkip) onSkip();
                else advanceToNext();
              }}
              className="mt-1 text-[11px] font-medium text-slate-500 underline underline-offset-4 hover:text-slate-800"
            >
              Skip for now
            </button>
          )}
        </div>

        {mode === "login" ? (
          <>
            <form
              onSubmit={handleLoginSubmit}
              className="mt-2 space-y-4 text-xs md:text-sm"
            >
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="mt-1 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-soft-card hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Logging in..." : "Log in and continue"}
              </button>
            </form>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                className="font-semibold text-cyan-700"
              >
                Register as a patient
              </button>
            </p>
          </>
        ) : (
          <>
            <form
              onSubmit={handleRegisterSubmit}
              className="mt-2 grid gap-4 text-xs md:grid-cols-2 md:text-sm"
            >
              {/* Left column (name, auth, contact) */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    First name
                  </label>
                  <input
                    name="firstName"
                    value={registerForm.firstName}
                    onChange={handleRegisterChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="John"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Last name
                  </label>
                  <input
                    name="lastName"
                    value={registerForm.lastName}
                    onChange={handleRegisterChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={registerForm.email}
                    onChange={handleRegisterChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="At least 8 characters"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-700">
                      Gender
                    </label>
                    <select
                      name="gender"
                      value={registerForm.gender}
                      onChange={handleRegisterChange}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">
                        Other / prefer not to say
                      </option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-700">
                      Date of birth
                    </label>
                    <input
                      type="date"
                      name="dob"
                      value={registerForm.dob}
                      onChange={handleRegisterChange}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Phone
                  </label>
                  <input
                    name="phone"
                    value={registerForm.phone}
                    onChange={handleRegisterChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="e.g. 01234 567890"
                  />
                </div>
              </div>

              {/* Right column (address) */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Address line 1
                  </label>
                  <input
                    name="address_line1"
                    value={registerForm.address_line1}
                    onChange={handleRegisterChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="123 Baker Street"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Address line 2
                  </label>
                  <input
                    name="address_line2"
                    value={registerForm.address_line2 ?? ""}
                    onChange={handleRegisterChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="Apartment, building, etc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-700">
                      City
                    </label>
                    <input
                      name="city"
                      value={registerForm.city}
                      onChange={handleRegisterChange}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="London"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-700">
                      County
                    </label>
                    <input
                      name="county"
                      value={registerForm.county}
                      onChange={handleRegisterChange}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="Greater London"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-700">
                      Postcode
                    </label>
                    <input
                      name="postalcode"
                      value={registerForm.postalcode}
                      onChange={handleRegisterChange}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="NW1 6XE"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-700">
                      Country
                    </label>
                    <input
                      name="country"
                      value={registerForm.country}
                      onChange={handleRegisterChange}
                      required
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      placeholder="UK"
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="md:col-span-2 mt-1 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {error}
                </div>
              )}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-soft-card hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading
                    ? "Creating account..."
                    : "Create account and continue"}
                </button>
              </div>
            </form>

            <p className="mt-4 text-center text-[11px] text-slate-500">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-semibold text-cyan-700"
              >
                Log in
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
