import Container from "@/components/ui/Container";

type TestimonialItem = {
  name: string;
  title: string;
  content: string;
  rating?: number;
};

type TestimonialsData = {
  heading?: string;
  subheading?: string;
  summaryText?: string;
  items?: TestimonialItem[];
};

const DEFAULT_ITEMS: TestimonialItem[] = [
  {
    name: "Alice D",
    title: "100% Excellent service",
    content:
      "My experience has been absolutely excellent. Professional, responsive and helpful. I switched providers and only regret not doing it sooner.",
    rating: 5,
  },
  {
    name: "Nicole S",
    title: "Top notch service every time",
    content:
      "Every order has been easy with clear communication. Dispatch is quick and the team are always happy to help.",
    rating: 5,
  },
  {
    name: "Carrie H",
    title: "Customer service that goes above and beyond",
    content:
      "Very efficient, with excellent communication and follow up. Best decision I have made switching to them.",
    rating: 5,
  },
];

export default function TestimonialsSection({
  data,
}: {
  data?: TestimonialsData;
}) {
  const heading =
    data?.heading ?? "Rated excellent by our patients";
  const subheading =
    data?.subheading ??
    "Independently collected reviews from real patients.";
  const summaryText =
    data?.summaryText ?? "★★★★★ 4.9 / 5 from 300+ reviews";

  const items =
    data?.items && data.items.length > 0
      ? data.items
      : DEFAULT_ITEMS;

  return (
    <section className="bg-pharmacy-bg py-10 md:py-12">
      <Container>
        <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 md:text-base">
              {heading}
            </h3>
            <p className="mt-1 text-xs text-slate-600 md:text-sm">
              {subheading}
            </p>
          </div>
          <div className="text-xs text-slate-500">{summaryText}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {items.map((t) => (
            <article
              key={t.name}
              className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-soft-card md:text-sm"
            >
              <h4 className="text-sm font-semibold text-slate-900">
                {t.title}
              </h4>
              <p className="mt-2 flex-1">{t.content}</p>
              <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                <span>{t.name}</span>
                <span>
                  {"★".repeat(t.rating ?? 5).padEnd(5, "☆")}
                </span>
              </div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
