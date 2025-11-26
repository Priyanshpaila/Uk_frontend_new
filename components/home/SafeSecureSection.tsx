import Container from "@/components/ui/Container";

export default function SafeSecureSection() {
  return (
    <section className="bg-white py-10 md:py-12">
      <Container>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 md:text-base">
              Safe and secure
            </h3>
            <ul className="mt-3 space-y-3 text-xs text-slate-600 md:text-sm">
              <li>
                <strong className="font-semibold text-slate-900">
                  Registered UK pharmacy
                </strong>
                <br />
                Fully licensed and regulated by the General Pharmaceutical
                Council.
              </li>
              <li>
                <strong className="font-semibold text-slate-900">
                  Approved UK-licensed treatments
                </strong>
                <br />
                Only genuine, MHRA-approved medications from trusted suppliers.
              </li>
              <li>
                <strong className="font-semibold text-slate-900">
                  Secure, encrypted platform
                </strong>
                <br />
                We use industry-standard encryption to protect your information.
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 shadow-soft-card md:text-sm">
            <h4 className="text-sm font-semibold text-slate-900">
              General Pharmaceutical Council
            </h4>
            <p className="mt-2">
              Pharmacy Express is registered with the GPhC, the regulator for
              pharmacists in the UK. They ensure we prioritise your safety and
              meet the highest standards.
            </p>
            <a
              href="https://www.pharmacyregulation.org/registers/pharmacy/registrationnumber/9012468"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Verify now
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
