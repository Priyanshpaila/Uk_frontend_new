"use client";

import Container from "@/components/ui/Container";
import toast from "react-hot-toast";

type ContactData = {
  sectionId?: string;
  label?: string;
  heading?: string;
  fullAddress?: string;
  directionsUrl?: string;
  directionsLabel?: string;
  copyButtonLabel?: string;
  callButtonLabel?: string;
  phoneHref?: string;
  bottomNote?: string;
  mapEmbedUrl?: string;
};

const DEFAULT_ADDRESS =
  "Pharmacy Express, Unit 4 The Office Campus, Paragon Business Park, Wakefield, West Yorkshire WF1 2UY";

export default function ContactStrip({ data }: { data?: ContactData }) {
  const sectionId = data?.sectionId ?? "contact";
  const label = data?.label ?? "Visit our pharmacy";
  const heading =
    data?.heading ?? "Pharmacy Express, Unit 4";
  const fullAddress = data?.fullAddress ?? DEFAULT_ADDRESS;

  const directionsUrl =
    data?.directionsUrl ??
    "https://www.google.com/maps/place/53%C2%B041'57.4%22N+1%C2%B030'37.9%22W";
  const directionsLabel =
    data?.directionsLabel ?? "Open directions";

  const copyButtonLabel =
    data?.copyButtonLabel ?? "Copy address";
  const callButtonLabel =
    data?.callButtonLabel ?? "Call 01924 971414";
  const phoneHref =
    data?.phoneHref ?? "tel:01924971414";

  const bottomNote =
    data?.bottomNote ??
    "Free parking available on-site. Please check opening times before you travel.";

  const mapEmbedUrl =
    data?.mapEmbedUrl ??
    "https://www.google.com/maps/embed?pb=!1m13!1m8!1m3!1d6108.179704923851!2d-1.511364!3d53.6991!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zNTPCsDQxJzU3LjQiTiAxwrAzMCczNy45Ilc!5e1!3m2!1sen!2sus!4v1764139161990!5m2!1sen!2sus";

  const handleCopyAddress = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullAddress);
        toast.success("Address copied to clipboard");
      } else {
        throw new Error("Clipboard not supported");
      }
    } catch {
      toast.error("Could not copy address. Please copy it manually.");
    }
  };

  return (
    <section
      id={sectionId}
      className="bg-gradient-to-b from-pharmacy-bg via-pharmacy-bg to-white py-8 md:py-10"
    >
      <Container>
        <div className="grid items-stretch gap-5 md:grid-cols-2">
          {/* Address + actions */}
          <div className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 text-xs text-slate-700 shadow-soft-card md:p-6 md:text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {label}
              </p>
              <h3 className="mt-1 text-sm font-semibold text-slate-900 md:text-base">
                {heading}
              </h3>
              <p className="mt-1">{fullAddress}</p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs md:text-[13px]">
                {/* Open directions */}
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-emerald-500 px-4 py-1.5 font-semibold text-white shadow-soft-card hover:bg-emerald-600"
                >
                  {directionsLabel}
                </a>

                {/* Copy address */}
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-semibold text-slate-800 hover:border-cyan-400 hover:bg-cyan-50"
                >
                  {copyButtonLabel}
                </button>

                {/* Call */}
                <a
                  href={phoneHref}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 font-semibold text-slate-800 hover:border-cyan-400 hover:bg-cyan-50"
                >
                  {callButtonLabel}
                </a>
              </div>
            </div>

            {/* Small reassurance line at bottom */}
            <p className="mt-4 text-[11px] text-slate-500">
              {bottomNote}
            </p>
          </div>

          {/* Map embed */}
          <div className="rounded-3xl border border-slate-200 bg-white p-2 shadow-soft-card">
            <div className="relative h-56 w-full overflow-hidden rounded-2xl md:h-64 lg:h-72">
              <iframe
                src={mapEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="h-full w-full border-0 rounded-2xl"
              />
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              Map data © Google. Check directions and opening times before you
              travel.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
