import Image from "next/image";
import Link from "next/link";
import type { Service } from "@/lib/types";

export default function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-soft-card transition hover:-translate-y-1 hover:border-cyan-400/80 hover:shadow-lg">
      <div>
        {/* Image */}
        <div className="relative mb-3 h-32 w-full overflow-hidden rounded-2xl bg-slate-100">
          {service.image ? (
            <Image
              src={service.image}
              alt={service.name}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-slate-400">
              Pharmacy service
            </div>
          )}
        </div>

        {/* Top pill + title + description */}
        <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium">
            {service.viewType === "card" ? "Private service" : "Service"}
          </span>
          <span className="text-[11px] text-emerald-600">
            {service.active ? "Available" : "Temporarily unavailable"}
          </span>
        </div>

        <h3 className="mb-1 text-sm font-semibold text-slate-900 md:text-base">
          {service.name}
        </h3>
        <p className="mb-3 line-clamp-3 text-xs text-slate-500 md:text-sm">
          {service.description || "No description available."}
        </p>
      </div>

      {/* Bottom row */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-500">
          Online consultation · Fast booking
        </div>

        {/* CTA -> /private-services/[slug] */}
        <Link
          href={`/private-services/${encodeURIComponent(service.slug)}`}
          className="inline-flex h-8 min-w-[112px] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 text-[11px] font-semibold text-cyan-800 shadow-sm transition group-hover:border-cyan-400 group-hover:bg-cyan-50"
        >
          {service.ctaText || "Book"}
        </Link>
      </div>
    </article>
  );
}
