import type { Service } from "@/lib/types";

export default function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-soft-card transition hover:-translate-y-1 hover:border-cyan-400/80 hover:shadow-lg">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium">
            {service.category}
          </span>
          {service.icon && (
            <span className="text-lg" aria-hidden="true">
              {service.icon}
            </span>
          )}
        </div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900 md:text-base">
          {service.name}
        </h3>
        <p className="mb-3 text-xs text-slate-500 md:text-sm line-clamp-3">
          {service.description || "No description available."}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="text-xs text-slate-500">
          From{" "}
          <span className="text-sm font-semibold text-emerald-600">
            £{service.priceFrom.toFixed(2)}
          </span>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-800 transition group-hover:border-cyan-400 group-hover:bg-cyan-50"
        >
          Learn more
        </button>
      </div>
    </article>
  );
}
