import Container from "@/components/ui/Container";

const FEATURES = [
  {
    title: "Registered UK pharmacy",
    desc: "Run by UK-registered pharmacists with independent clinical team."
  },
  {
    title: "Fully regulated service",
    desc: "Inspected and regulated by the General Pharmaceutical Council."
  },
  {
    title: "Online convenience",
    desc: "Complete assessment online – no GP appointment required."
  },
  {
    title: "Fast, discreet delivery",
    desc: "Tracked delivery in plain packaging to your door."
  }
];

export default function KeyBenefits() {
  return (
    <section id="nhs" className="bg-pharmacy-bg py-8 md:py-10">
      <Container>
        <div className="grid gap-4 md:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-slate-200 bg-white p-4 text-xs shadow-soft-card"
            >
              <h3 className="text-sm font-semibold text-slate-900">
                {feature.title}
              </h3>
              <p className="mt-1 text-slate-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
