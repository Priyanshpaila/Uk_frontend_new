// app/nhs-services/NhsServicesClient.tsx
"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import Container from "@/components/ui/Container";
import {
  Truck,
  ShieldCheck,
  MessageCircle,
  Clock,
  MapPin,
  Phone,
  Info,
  Package2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  X,
} from "lucide-react";
import { nhsRegisterApi, type NhsRegisterPayload } from "@/lib/api";
import ContactStrip from "@/components/home/ContactStrip";

/* --------------------- form state & constants --------------------- */

type NhsFormState = {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  nhsNumber: string;
  email: string;
  phone: string;

  address: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  country: string;

  useAltDelivery: boolean;
  deliveryAddress: string;
  deliveryAddress1: string;
  deliveryAddress2: string;
  deliveryCity: string;
  deliveryPostcode: string;
  deliveryCountry: string;

  exemption: string;
  exemptionNumber: string;
  exemptionExpiry: string;

  consent_patient: boolean;
  consent_nomination: boolean;
  consent_nomination_explained: boolean;
  consent_exemption_signed: boolean;
  consent_scr_access: boolean;
};

const initialForm: NhsFormState = {
  firstName: "",
  lastName: "",
  dob: "",
  gender: "",
  nhsNumber: "",
  email: "",
  phone: "",

  address: "",
  address1: "",
  address2: "",
  city: "",
  postcode: "",
  country: "United Kingdom",

  useAltDelivery: false,
  deliveryAddress: "",
  deliveryAddress1: "",
  deliveryAddress2: "",
  deliveryCity: "",
  deliveryPostcode: "",
  deliveryCountry: "United Kingdom",

  exemption: "",
  exemptionNumber: "",
  exemptionExpiry: "",

  consent_patient: false,
  consent_nomination: false,
  consent_nomination_explained: false,
  consent_exemption_signed: false,
  consent_scr_access: false,
};

const EXEMPTION_OPTIONS: { value: string; label: string }[] = [
  {
    value: "pays",
    label: "The patient pays for their prescriptions",
  },
  {
    value: "age_60_plus",
    label: "The patient is 60 years of age or over, or is under 16",
  },
  {
    value: "age_16_18_full_time_education",
    label: "The patient is 16, 17 or 18 and in full-time education",
  },
  { value: "maternity_certificate", label: "Maternity exemption certificate" },
  { value: "medical_certificate", label: "Medical exemption certificate" },
  {
    value: "prescription_prepayment",
    label: "Prescription prepayment certificate",
  },
  {
    value: "hrt_prepayment",
    label: "HRT only prescription prepayment certificate",
  },
  {
    value: "mod_exemption",
    label: "Ministry of Defence prescription exemption certificate",
  },
  { value: "hc2_certificate", label: "HC2 certificate" },
  {
    value: "income_support_esa",
    label: "Income Support or Income-related Employment and Support Allowance",
  },
  {
    value: "income_based_jsa",
    label: "Income-based Jobseeker’s Allowance",
  },
  {
    value: "tax_credit_exemption",
    label: "Tax Credit exemption certificate",
  },
  {
    value: "pension_credit_guarantee",
    label: "Pension Credit Guarantee Credit",
  },
  {
    value: "universal_credit_eligible",
    label: "Universal Credit and meets the eligibility criteria",
  },
];

const CONSENT_ITEMS: { key: keyof NhsFormState; label: string }[] = [
  {
    key: "consent_patient",
    label:
      "I am the patient named above, or the carer of the patient named above",
  },
  {
    key: "consent_nomination",
    label:
      "I understand that I am nominating Pharmacy Express to receive my NHS prescriptions, and I consent to being contacted by email and SMS with updates about my nomination and orders",
  },
  {
    key: "consent_nomination_explained",
    label: "I understand the meaning of nomination and how it works",
  },
  {
    key: "consent_exemption_signed",
    label:
      "I understand that the pharmacy will sign my prescription based on the exemption I have declared",
  },
  {
    key: "consent_scr_access",
    label:
      "I give consent for Pharmacy Express to access my NHS Summary Care Records if needed",
  },
];

const FAQ_ITEMS = [
  {
    question: "Do you charge for NHS prescription deliveries?",
    answer:
      "No. NHS prescription deliveries from our pharmacy are provided without any delivery fee. The service is free for all eligible patients across England.",
  },
  {
    question:
      "How can I choose Pharmacy Express to handle my NHS prescriptions?",
    answer:
      "You complete this online registration form and select us as your nominated pharmacy. Once confirmed, your GP will send your NHS prescriptions to us and we will deliver them direct to your home.",
  },
  {
    question: "What details are needed when I create an account?",
    answer:
      "We need your basic personal information, your GP details and your regular delivery address. This ensures prescriptions can be managed and delivered safely.",
  },
  {
    question: "Do I need to speak with my GP before using your NHS service?",
    answer:
      "No. You don’t need to call your GP first. Once you register, we’ll handle the nomination process and keep your GP informed.",
  },
  {
    question: "When is the best time to place an order?",
    answer:
      "We recommend requesting your medication around 7 days before you are due to run out. This gives enough time for your GP to authorise the prescription and for us to dispense and deliver it.",
  },
  {
    question:
      "I do not pay for NHS prescriptions. Can I still use your service?",
    answer:
      "Yes. You can still use our service if you are exempt from paying for NHS prescriptions. Nothing changes for you.",
  },
  {
    question: "Can I use my EPC with your pharmacy?",
    answer:
      "Yes, if you have an NHS prepayment certificate it covers your prescriptions through us exactly the same way as any other nominated pharmacy.",
  },
  {
    question: "What if I need support?",
    answer:
      "Our team of UK-based pharmacists and support staff are available by phone or email to help with any questions about your medication or deliveries.",
  },
  {
    question: "How long does delivery usually take?",
    answer:
      "Once your prescription is approved and dispensed, most deliveries arrive within two to three working days depending on your location and courier schedule.",
  },
  {
    question: "Can I change where my medication is delivered?",
    answer:
      "Yes. You can update your delivery address in your account whenever needed. Please let us know as soon as possible so we can use the best place for your next order.",
  },
];

/* ----------------------- NHS register modal ----------------------- */

type NhsRegisterModalProps = {
  open: boolean;
  onClose: () => void;
};

function NhsRegisterModal({ open, onClose }: NhsRegisterModalProps) {
  const [form, setForm] = useState<NhsFormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const update = (patch: Partial<NhsFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleClose = () => {
    if (submitting) return;
    setError(null);
    setSuccess(null);
    onClose();
  };

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const allConsents =
      form.consent_patient &&
      form.consent_nomination &&
      form.consent_nomination_explained &&
      form.consent_exemption_signed &&
      form.consent_scr_access;

    const hasRequired =
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.dob &&
      form.email.trim() &&
      form.phone.trim() &&
      form.address.trim() &&
      form.city.trim() &&
      form.postcode.trim() &&
      form.exemption;

    if (!hasRequired || !allConsents) {
      setError(
        "Please complete all required fields and tick all agreement boxes."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: NhsRegisterPayload = {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        dob: form.dob,
        gender: form.gender || "unspecified",
        nhs_number: form.nhsNumber.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),

        address: form.address.trim(),
        address1: form.address1.trim(),
        address2: form.address2.trim(),
        city: form.city.trim(),
        postcode: form.postcode.trim(),
        country: form.country || "United Kingdom",

        use_alt_delivery: form.useAltDelivery,
        delivery_address: (form.useAltDelivery
          ? form.deliveryAddress
          : form.address
        ).trim(),
        delivery_address1: (form.useAltDelivery
          ? form.deliveryAddress1
          : form.address1
        ).trim(),
        delivery_address2: (form.useAltDelivery
          ? form.deliveryAddress2
          : form.address2
        ).trim(),
        delivery_city: (form.useAltDelivery
          ? form.deliveryCity
          : form.city
        ).trim(),
        delivery_postcode: (form.useAltDelivery
          ? form.deliveryPostcode
          : form.postcode
        ).trim(),
        delivery_country:
          (form.useAltDelivery ? form.deliveryCountry : form.country) ||
          "United Kingdom",

        exemption: form.exemption,
        exemption_number: form.exemptionNumber.trim() || undefined,
        exemption_expiry: form.exemptionExpiry || undefined,

        consent_patient: form.consent_patient,
        consent_nomination: form.consent_nomination,
        consent_nomination_explained: form.consent_nomination_explained,
        consent_exemption_signed: form.consent_exemption_signed,
        consent_scr_access: form.consent_scr_access,

        meta: {
          source: "nhs-services-page-modal",
          utm_campaign: "nhs-nomination-q1",
        },
      };

      await nhsRegisterApi(payload);

      setSuccess("Thank you. Your NHS registration has been submitted.");
      setForm(initialForm);
    } catch (err: any) {
      setError(err?.message || "Could not submit your NHS registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const smallInput =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs md:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500";

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 px-2 py-4 sm:px-4">
      <div className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 md:px-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              NHS nomination
            </p>
            <h2 className="text-sm font-semibold text-slate-900 md:text-base">
              Register with Pharmacy Express for NHS prescriptions
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex max-h-[82vh] flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 md:px-6 md:py-5">
            {/* About you */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 md:p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                About you
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    First name *
                  </label>
                  <input
                    className={smallInput}
                    value={form.firstName}
                    onChange={(e) => update({ firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Last name *
                  </label>
                  <input
                    className={smallInput}
                    value={form.lastName}
                    onChange={(e) => update({ lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Date of birth *
                  </label>
                  <input
                    type="date"
                    className={smallInput}
                    value={form.dob}
                    onChange={(e) => update({ dob: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Gender *
                  </label>
                  <select
                    className={smallInput}
                    value={form.gender}
                    onChange={(e) => update({ gender: e.target.value })}
                  >
                    <option value="">Please select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other / prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    NHS number (if known)
                  </label>
                  <input
                    className={smallInput}
                    value={form.nhsNumber}
                    onChange={(e) => update({ nhsNumber: e.target.value })}
                    placeholder="943 476 5919"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Email *
                  </label>
                  <input
                    type="email"
                    className={smallInput}
                    value={form.email}
                    onChange={(e) => update({ email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Mobile number *
                  </label>
                  <input
                    className={smallInput}
                    value={form.phone}
                    onChange={(e) => update({ phone: e.target.value })}
                    placeholder="+447700900123"
                  />
                </div>
              </div>
            </section>

            {/* Address */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Address & delivery
              </h3>
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Address line
                    </label>
                    <input
                      className={smallInput}
                      value={form.address}
                      onChange={(e) => update({ address: e.target.value })}
                      placeholder="10 High Street"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Address line 2
                    </label>
                    <input
                      className={smallInput}
                      value={form.address1}
                      onChange={(e) => update({ address1: e.target.value })}
                      placeholder="Flat 2B"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Address line 3 (optional)
                    </label>
                    <input
                      className={smallInput}
                      value={form.address2}
                      onChange={(e) => update({ address2: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      City / town
                    </label>
                    <input
                      className={smallInput}
                      value={form.city}
                      onChange={(e) => update({ city: e.target.value })}
                      placeholder="Manchester"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Postcode
                    </label>
                    <input
                      className={smallInput}
                      value={form.postcode}
                      onChange={(e) => update({ postcode: e.target.value })}
                      placeholder="M1 2AB"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-700">
                      Country
                    </label>
                    <input
                      className={smallInput}
                      value={form.country}
                      onChange={(e) => update({ country: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <input
                    id="use-alt"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                    checked={form.useAltDelivery}
                    onChange={(e) =>
                      update({ useAltDelivery: e.target.checked })
                    }
                  />
                  <label
                    htmlFor="use-alt"
                    className="cursor-pointer select-none"
                  >
                    Use a different address for delivery (for example, your
                    workplace or a nominated safe place)
                  </label>
                </div>

                {form.useAltDelivery && (
                  <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Delivery address line
                      </label>
                      <input
                        className={smallInput}
                        value={form.deliveryAddress}
                        onChange={(e) =>
                          update({ deliveryAddress: e.target.value })
                        }
                        placeholder="Pharmacy Express"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Delivery address line 2
                      </label>
                      <input
                        className={smallInput}
                        value={form.deliveryAddress1}
                        onChange={(e) =>
                          update({ deliveryAddress1: e.target.value })
                        }
                        placeholder="Suite 4"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Delivery address line 3
                      </label>
                      <input
                        className={smallInput}
                        value={form.deliveryAddress2}
                        onChange={(e) =>
                          update({ deliveryAddress2: e.target.value })
                        }
                        placeholder="Business Park"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Delivery city
                      </label>
                      <input
                        className={smallInput}
                        value={form.deliveryCity}
                        onChange={(e) =>
                          update({ deliveryCity: e.target.value })
                        }
                        placeholder="Manchester"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Delivery postcode
                      </label>
                      <input
                        className={smallInput}
                        value={form.deliveryPostcode}
                        onChange={(e) =>
                          update({ deliveryPostcode: e.target.value })
                        }
                        placeholder="M2 3CD"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700">
                        Delivery country
                      </label>
                      <input
                        className={smallInput}
                        value={form.deliveryCountry}
                        onChange={(e) =>
                          update({ deliveryCountry: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Exemption status */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Exemption Status
              </h3>
              <div className="space-y-2">
                {EXEMPTION_OPTIONS.map((opt) => {
                  const checked = form.exemption === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs md:text-sm ${
                        checked
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <input
                        type="radio"
                        name="exemption"
                        className="mt-1 h-4 w-4 border-slate-300 text-emerald-600"
                        checked={checked}
                        onChange={() => update({ exemption: opt.value })}
                      />
                      <span className="text-slate-800">{opt.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Exemption certificate number
                  </label>
                  <input
                    className={smallInput}
                    value={form.exemptionNumber}
                    onChange={(e) =>
                      update({ exemptionNumber: e.target.value })
                    }
                    placeholder="Certificate number (if applicable)"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">
                    Expiry date
                  </label>
                  <input
                    type="date"
                    className={smallInput}
                    value={form.exemptionExpiry}
                    onChange={(e) =>
                      update({ exemptionExpiry: e.target.value })
                    }
                  />
                </div>
              </div>
            </section>

            {/* Agreement / consents */}
            <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Agreement
              </h3>
              <div className="space-y-2 text-xs text-slate-800 md:text-sm">
                {CONSENT_ITEMS.map((c) => {
                  const checked = form[c.key] as boolean;
                  return (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
                        checked={checked}
                        onChange={(e) =>
                          update({ [c.key]: e.target.checked } as any)
                        }
                      />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            </section>

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                <span>{success}</span>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <p className="text-[11px] text-slate-500">
              By submitting this form you confirm the information is accurate to
              the best of your knowledge.
            </p>
            <div className="flex gap-2 md:justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex items-center justify-center rounded-full px-5 py-1.5 text-xs font-semibold text-white shadow-sm ${
                  submitting
                    ? "bg-emerald-300 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {submitting ? "Submitting…" : "Submit NHS registration"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------- main NHS page content ---------------------- */

export default function NhsServicesClient() {
  const [showModal, setShowModal] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <>
      <main className="bg-slate-50 mt-28">
        {/* HERO */}
        <section className="border-b border-emerald-100/70 bg-gradient-to-b from-emerald-50/70 via-white to-emerald-50/40">
          <Container>
            <div className="flex flex-col gap-8 py-8 md:flex-row md:items-center md:py-12 lg:py-16">
              {/* Left */}
              <div className="flex-1 space-y-4 md:space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                  <span>NHS SERVICE</span>
                  <span className="h-1 w-1 rounded-full bg-emerald-700" />
                  <span>Free tracked NHS delivery</span>
                </div>

                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
                  Simple sign up, free delivery and{" "}
                  <span className="bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
                    friendly pharmacist support
                  </span>
                </h1>

                <p className="max-w-xl text-sm text-slate-600 md:text-base">
                  Manage your repeats online in minutes and nominate Pharmacy
                  Express as your NHS pharmacy. We&apos;ll deliver your
                  medication direct to your door with full tracking and discreet
                  packaging.
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    Start NHS registration
                  </button>
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-semibold text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50"
                  >
                    See how it works
                  </a>
                </div>

                <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <Truck className="h-3.5 w-3.5 text-emerald-500" />
                    Free tracked delivery
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    NHS-approved UK pharmacy
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 shadow-sm ring-1 ring-slate-100">
                    <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
                    Friendly pharmacist support
                  </span>
                </div>
              </div>

              {/* Right - image */}
              <div className="flex-1">
                <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-soft-card">
                  <div className="relative h-56 w-full sm:h-64 md:h-72">
                    <Image
                      src="/images/nhs-hero-device.jpg"
                      alt="NHS prescriptions delivered with tracked courier"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] text-slate-600">
                    <p className="font-semibold text-slate-800">
                      Free NHS prescription delivery
                    </p>
                    <p>
                      Tracked parcels, discreet packaging, UK-registered
                      pharmacy team.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ABOUT SECTION */}
        <section className="border-b border-slate-200 bg-white/95 py-8 md:py-12">
          <Container>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-soft-card md:p-7">
              <h2 className="mb-3 text-lg font-semibold text-slate-900 md:text-xl">
                About our NHS service
              </h2>
              <p className="mx-auto max-w-2xl text-sm text-slate-600">
                We are a UK-registered community pharmacy providing free NHS
                repeat prescription delivery across England. You stay in
                control, we work with your GP and deliver your medication safely
                and discreetly.
              </p>
              <div className="mt-5 grid gap-3 text-left text-sm text-slate-700 md:grid-cols-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>
                    Free NHS-approved service run by a GPhC registered pharmacy
                    team
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Electronic prescriptions sent directly from your GP</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Tracked Royal Mail delivery included, at no extra cost</p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                  <p>Discreet, recyclable packaging & SMS/email updates</p>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* WHY CHOOSE US */}
        <section className="border-b border-slate-200 bg-emerald-50/40 py-8 md:py-12">
          <Container>
            <div className="grid gap-8 md:grid-cols-[1.3fr_1fr] md:items-center">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
                  Why choose our NHS service
                </h2>
                <p className="mt-2 max-w-xl text-sm text-slate-600">
                  We combine modern technology with the care of a local
                  community pharmacy. That means safe dispensing, personal
                  advice and convenient delivery.
                </p>
                <ul className="mt-4 space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <Truck className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>Free tracked delivery straight to your door.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>
                      Fast access to advice and prescription updates via SMS and
                      email.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>
                      Secure handling of your NHS prescriptions with full
                      clinical checks.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <MessageCircle className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>
                      Friendly UK-based pharmacists on hand if you have concerns
                      about your medicines.
                    </span>
                  </li>
                </ul>
              </div>

              <div className="grid gap-4 text-sm text-slate-700">
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft-card">
                  <Truck className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      Free delivery
                    </p>
                    <p className="text-xs text-slate-600">
                      No delivery fees for NHS prescriptions across England.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft-card">
                  <Package2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      Discreet packaging
                    </p>
                    <p className="text-xs text-slate-600">
                      Plain, secure packaging with no medication names visible.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-soft-card">
                  <ShieldCheck className="h-5 w-5 flex-shrink-0 text-emerald-500" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      Trusted pharmacy
                    </p>
                    <p className="text-xs text-slate-600">
                      GPhC-registered pharmacy following NHS clinical
                      guidelines.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* HOW IT WORKS */}
        <section
          id="how-it-works"
          className="border-b border-slate-200 bg-white py-8 md:py-12"
        >
          <Container>
            <div className="mx-auto max-w-2xl">
              <h2 className="text-center text-lg font-semibold text-slate-900 md:text-xl">
                How it works
              </h2>
              <p className="mt-2 text-center text-sm text-slate-600">
                Signing up only takes a few minutes. After that, we take care of
                the prescription routing and delivery, while you stay in control
                of your medication.
              </p>

              <ol className="mt-5 space-y-3 text-sm text-slate-700">
                <li className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Step 1
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    Sign up online
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Fill in our secure NHS registration form with your details
                    and choose Pharmacy Express as your nominated pharmacy.
                  </p>
                </li>
                <li className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Step 2
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    Request your medication
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Order your repeat medication through our service and we will
                    request approval from your GP.
                  </p>
                </li>
                <li className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Step 3
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    Your GP signs it off
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Once your GP approves, they send your prescription to us
                    electronically via the NHS system.
                  </p>
                </li>
                <li className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Step 4
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    We prepare your medicines
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Our pharmacy team checks your prescription, dispenses safely
                    and packs your medicines in discreet packaging.
                  </p>
                </li>
                <li className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                    Step 5
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    Delivery to your door
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    We send your medicines using a tracked service. You&apos;ll
                    receive updates so you know when to expect your parcel.
                  </p>
                </li>
              </ol>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="border-b border-slate-200 bg-white py-8 md:py-12">
          <Container>
            <div className="mx-auto max-w-3xl">
              <div className="mb-4 text-center md:mb-6">
                <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
                  Frequently asked questions
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Answers to some of the most common questions about our NHS
                  prescription service.
                </p>
              </div>

              <div className="space-y-2">
                {FAQ_ITEMS.map((item, idx) => {
                  const open = openFaq === idx;
                  return (
                    <div
                      key={item.question}
                      className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3 text-sm text-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenFaq((prev) => (prev === idx ? null : idx))
                        }
                        className="flex w-full items-center justify-between gap-3 text-left"
                      >
                        <span className="font-medium">{item.question}</span>
                        {open ? (
                          <ChevronUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-emerald-500" />
                        )}
                      </button>
                      {open && (
                        <p className="mt-2 text-xs text-slate-600">
                          {item.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Container>
        </section>

        {/* VISIT US / FOOTER CARD */}
        <ContactStrip
          data={{
            sectionId: "contact",
            label: "Visit our pharmacy",
            heading: "Pharmacy Express, Unit 4",
            fullAddress:
              "Unit 4 The Office Campus, Paragon Business Park, Wakefield, West Yorkshire WF1 2UY",
            directionsUrl:
              "https://www.google.com/maps/place/53%C2%B041'57.4%22N+1%C2%B030'37.9%22W",
            directionsLabel: "Get directions",
            copyButtonLabel: "Copy address",
            callButtonLabel: "Call 01924 971414",
            phoneHref: "tel:+441924971414",
            bottomNote:
              "Prefer to pop in? You're always welcome during opening hours. Free parking available on-site – please check opening times before you travel.",
            // optional: custom embed URL if you have one
            // mapEmbedUrl: "https://www.google.com/maps/embed?...",
          }}
        />
      </main>

      {/* Big NHS register modal */}
      <NhsRegisterModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
