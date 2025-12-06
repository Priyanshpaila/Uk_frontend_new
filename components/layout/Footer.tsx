// components/layout/Footer.tsx
import Container from "@/components/ui/Container";
import type { DynamicFooterContent } from "@/lib/api";

type FooterProps = {
  data?: DynamicFooterContent | null;
};

export default function Footer({ data }: FooterProps) {
  const brandName = data?.brandName ?? "Pharmacy Express";
  const brandDescription =
    data?.brandDescription ??
    "Experience personalised confidential care with our private pharmacy services tailored to your unique needs.";

  const infoLinks =
    data?.infoLinks && data.infoLinks.length > 0
      ? data.infoLinks
      : [
          { label: "About us", href: "/about" },
          { label: "Contact us", href: "/contact" },
          { label: "Terms & conditions", href: "/terms" },
          { label: "Privacy policy", href: "/privacy" },
        ];

  const phoneLabel =
    data?.contact?.phoneLabel ?? "Phone: 01924 971414";
  const emailLabel =
    data?.contact?.emailLabel ??
    "Email: info@pharmacy-express.co.uk";
  const addressLabel =
    data?.contact?.addressLabel ?? "Address: Your pharmacy address";

  const bottomLeft =
    data?.bottomLeft ??
    `© ${new Date().getFullYear()} Pharmacy Express. All rights reserved.`;
  const bottomRight =
    data?.bottomRight ??
    "GPhC registered pharmacy. This website does not replace medical advice.";

  return (
    <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-600">
      <Container>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {brandName}
            </h3>
            <p className="mt-2 max-w-sm text-xs text-slate-500">
              {brandDescription}
            </p>
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Information
            </h4>
            <ul className="space-y-1">
              {infoLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="hover:text-cyan-700 hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Contact
            </h4>
            <ul className="space-y-1">
              <li>{phoneLabel}</li>
              <li>{emailLabel}</li>
              <li>{addressLabel}</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-4 text-[11px] text-slate-500 md:flex-row md:items-center">
          <p>{bottomLeft}</p>
          <p>{bottomRight}</p>
        </div>
      </Container>
    </footer>
  );
}
