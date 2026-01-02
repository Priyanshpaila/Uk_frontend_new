"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Container from "@/components/ui/Container";
import { registerPatientApi, type RegisterPatientPayload } from "@/lib/api";
import toast from "react-hot-toast";

const initialForm: RegisterPatientPayload = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  gender: "male",
  phone: "",
  dob: "",

  // Billing / home address
  address_line1: "",
  address_line2: "",
  city: "",
  county: "",
  postalcode: "",
  country: "UK",

  // ✅ Shipping address (add these fields in RegisterPatientPayload)
  shipping_address_line1: "",
  shipping_address_line2: "",
  shipping_city: "",
  shipping_county: "",
  shipping_postalcode: "",
  shipping_country: "UK",
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterPatientPayload>(initialForm);
  const [useDifferentShipping, setUseDifferentShipping] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: RegisterPatientPayload = useDifferentShipping
        ? form
        : {
            ...form,
            shipping_address_line1: form.address_line1,
            shipping_address_line2: form.address_line2,
            shipping_city: form.city,
            shipping_county: form.county,
            shipping_postalcode: form.postalcode,
            shipping_country: form.country,
          };

      await registerPatientApi(payload);

      toast.success("Account created successfully. Please log in.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-pharmacy-bg py-10 mt-28 md:py-14">
      <Container>
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-soft-card md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Create account
          </p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
            Register as a Pharmacy Express patient
          </h1>
          <p className="mt-1 text-xs text-slate-600 md:text-sm">
            Securely manage your treatments, appointments and orders in one
            place.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-5 grid gap-4 text-xs md:grid-cols-2 md:text-sm"
          >
            {/* Left column */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  First name
                </label>
                <input
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
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
                  value={form.lastName}
                  onChange={handleChange}
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
                    value={form.gender}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other / prefer not to say</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-700">
                    Date of birth
                  </label>
                  <input
                    type="date"
                    name="dob"
                    value={form.dob}
                    onChange={handleChange}
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
                  value={form.phone}
                  onChange={handleChange}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  placeholder="e.g. 01234 567890"
                />
              </div>
            </div>

            {/* Right column (Billing / home address) */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-medium text-slate-700">
                  Address line 1
                </label>
                <input
                  name="address_line1"
                  value={form.address_line1}
                  onChange={handleChange}
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
                  value={form.address_line2}
                  onChange={handleChange}
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
                    value={form.city}
                    onChange={handleChange}
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
                    value={form.county}
                    onChange={handleChange}
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
                    value={form.postalcode}
                    onChange={handleChange}
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
                    value={form.country}
                    onChange={handleChange}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    placeholder="UK"
                  />
                </div>
              </div>
            </div>

            {/* ✅ Shipping address */}
            <div className="md:col-span-2">
              <div className="mt-2 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Shipping address
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      By default we will use your address above.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={useDifferentShipping}
                      onChange={(e) => setUseDifferentShipping(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-2 focus:ring-cyan-100"
                    />
                    Use a different shipping address
                  </label>
                </div>

                {useDifferentShipping ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Shipping address line 1
                      </label>
                      <input
                        name="shipping_address_line1"
                        value={form.shipping_address_line1}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        placeholder="123 Baker Street"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Shipping address line 2
                      </label>
                      <input
                        name="shipping_address_line2"
                        value={form.shipping_address_line2}
                        onChange={handleChange}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        placeholder="Apartment, building, etc."
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Shipping city
                      </label>
                      <input
                        name="shipping_city"
                        value={form.shipping_city}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        placeholder="London"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Shipping county
                      </label>
                      <input
                        name="shipping_county"
                        value={form.shipping_county}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        placeholder="Greater London"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Shipping postcode
                      </label>
                      <input
                        name="shipping_postalcode"
                        value={form.shipping_postalcode}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        placeholder="NW1 6XE"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-medium text-slate-700">
                        Shipping country
                      </label>
                      <input
                        name="shipping_country"
                        value={form.shipping_country}
                        onChange={handleChange}
                        required
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                        placeholder="UK"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white shadow-soft-card hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Creating account..." : "Create account"}
              </button>
            </div>
          </form>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-cyan-700">
              Log in
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
