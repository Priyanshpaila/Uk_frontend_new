"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { loginApi, type LoginPayload, type LoginResponse } from "@/lib/api";
import toast from "react-hot-toast";
import { useAuth } from "@/components/auth/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuth(); // 👈 get setAuth from context
  const [form, setForm] = useState<LoginPayload>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res: LoginResponse = await loginApi(form);

      // 🔥 Update global auth (this also writes to localStorage inside AuthProvider)
      setAuth(res.user, res.session_token);

      toast.success("Logged in successfully");
      router.push("/profile");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-pharmacy-bg py-10 mt-28 md:py-14">
      <Container>
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-soft-card md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Welcome back
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
            Log in to your Pharmacy Express account
          </h1>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">
            Manage your profile, view your orders and quickly reorder
            treatments.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-5 space-y-4 text-xs md:text-sm"
          >
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
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
                value={form.password}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-soft-card hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-semibold text-cyan-700">
              Register as a patient
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
