import Container from "@/components/ui/Container";

type SafeBullet = {
  title: string;
  body: string;
};

type SafeSecureData = {
  title?: string;
  bullets?: SafeBullet[];
  cardTitle?: string;
  cardBody?: string;
  cardButtonLabel?: string;
  cardButtonHref?: string;
};

const DEFAULT_BULLETS: SafeBullet[] = [
  {
    title: "Registered UK pharmacy",
    body: "Fully licensed and regulated by the General Pharmaceutical Council.",
  },
  {
    title: "Approved UK-licensed treatments",
    body: "Only genuine, MHRA-approved medications from trusted suppliers.",
  },
  {
    title: "Secure, encrypted platform",
    body: "We use industry-standard encryption to protect your information.",
  },
];

export default function SafeSecureSection({
  data,
}: {
  data?: SafeSecureData;
}) {
  const title = data?.title ?? "Safe and secure";
  const bullets =
    data?.bullets && data.bullets.length > 0
      ? data.bullets
      : DEFAULT_BULLETS;

  const cardTitle =
    data?.cardTitle ?? "General Pharmaceutical Council";
  const cardBody =
    data?.cardBody ??
    "Pharmacy Express is registered with the GPhC, the regulator for pharmacists in the UK. They ensure we prioritise your safety and meet the highest standards.";
  const cardButtonLabel = data?.cardButtonLabel ?? "Verify now";
  const cardButtonHref =
    data?.cardButtonHref ??
    "https://www.pharmacyregulation.org/registers/pharmacy/registrationnumber/9012468";

  return (
    <section className="bg-white py-10 md:py-12">
      <Container>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 md:text-base">
              {title}
            </h3>
            <ul className="mt-3 space-y-3 text-xs text-slate-600 md:text-sm">
              {bullets.map((b) => (
                <li key={b.title}>
                  <strong className="font-semibold text-slate-900">
                    {b.title}
                  </strong>
                  <br />
                  {b.body}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 shadow-soft-card md:text-sm">
            <h4 className="text-sm font-semibold text-slate-900">
              {cardTitle}
            </h4>
            <p className="mt-2">{cardBody}</p>
            <a
              href={cardButtonHref}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              {cardButtonLabel}
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
