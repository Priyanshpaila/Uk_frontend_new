import Container from "@/components/ui/Container";

export default function ContactStrip() {
  return (
    <section id="contact" className="bg-pharmacy-bg py-8 md:py-10">
      <Container>
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-700 shadow-soft-card md:text-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Pharmacy Express, Unit 4
            </h3>
            <p className="mt-1">
              The Office Campus, Paragon Business Park, Wakefield, West Yorkshire.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <button className="rounded-full bg-emerald-500 px-3 py-1.5 font-semibold text-white hover:bg-emerald-600">
                Open directions
              </button>
              <button className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-800 hover:border-cyan-400 hover:bg-cyan-50">
                Call 01924 971414
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500 md:text-sm">
            Map placeholder<br />
            Embed your Google Maps iframe or custom map component here.
          </div>
        </div>
      </Container>
    </section>
  );
}
