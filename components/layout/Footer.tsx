import Container from "@/components/ui/Container";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-8 text-xs text-slate-600">
      <Container>
        <div className="grid gap-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Pharmacy Express
            </h3>
            <p className="mt-2 max-w-sm text-xs text-slate-500">
              Experience personalised confidential care with our private 
              pharmacy services tailored to your unique needs.
            </p>
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Information
            </h4>
            <ul className="space-y-1">
              <li>About us</li>
              <li>Contact us</li>
              <li>Terms & conditions</li>
              <li>Privacy policy</li>
            </ul>
          </div>
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Contact
            </h4>
            <ul className="space-y-1">
              <li>Phone: 01924 971414</li>
              <li>Email: info@pharmacy-express.co.uk</li>
              <li>Address: Your pharmacy address</li>
            </ul>
          </div>
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-slate-200 pt-4 text-[11px] text-slate-500 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Pharmacy Express. All rights reserved.</p>
          <p>GPhC registered pharmacy. This website does not replace medical advice.</p>
        </div>
      </Container>
    </footer>
  );
}
