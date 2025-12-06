"use client";

import { useState } from "react";
import Container from "@/components/ui/Container";
import { Plus, Minus } from "lucide-react";

type FAQItem = { q: string; a: string };

type FAQData = {
  heading?: string;
  items?: FAQItem[];
  footerText?: string;
  footerLinkLabel?: string;
  footerLinkHref?: string;
};

const DEFAULT_FAQS: FAQItem[] = [
  {
    q: "Why are weight loss treatment prices changing?",
    a: "Medication and supply costs can change based on manufacturer pricing and availability. We always display the most up to date prices before you complete your order.",
  },
  {
    q: "Can I switch weight loss treatments?",
    a: "This will depend on your medical history and prescriber assessment. Our clinical team will review your consultation and recommend suitable options.",
  },
  {
    q: "Is my information safe?",
    a: "Yes. We use industry-standard encryption and follow strict data protection laws to keep your information secure.",
  },
  {
    q: "Will my delivery be discreet?",
    a: "Absolutely. All orders are sent in plain, unbranded packaging with no reference to the contents.",
  },
];

export default function FAQSection({ data }: { data?: FAQData }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const heading =
    data?.heading ?? "Frequently Asked Questions";
  const items =
    data?.items && data.items.length > 0 ? data.items : DEFAULT_FAQS;

  const footerText = data?.footerText ?? "More questions?";
  const footerLinkLabel =
    data?.footerLinkLabel ?? "Visit our help centre";
  const footerLinkHref = data?.footerLinkHref ?? "#contact";

  return (
    <section id="faq" className="bg-white py-10 md:py-12">
      <Container>
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
            {heading}
          </h2>
        </div>
        <div className="space-y-2">
          {items.map((item, idx) => {
            const open = openIndex === idx;
            return (
              <div
                key={item.q}
                className="rounded-2xl border border-slate-200 bg-slate-50"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-xs font-medium text-slate-800 md:text-sm"
                  onClick={() => setOpenIndex(open ? null : idx)}
                >
                  <span>{item.q}</span>
                  {open ? (
                    <Minus className="h-4 w-4 text-slate-500" />
                  ) : (
                    <Plus className="h-4 w-4 text-slate-500" />
                  )}
                </button>
                {open && (
                  <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-600 md:text-sm">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          {footerText}{" "}
          <a
            href={footerLinkHref}
            className="text-cyan-700 underline"
          >
            {footerLinkLabel}
          </a>
        </p>
      </Container>
    </section>
  );
}
