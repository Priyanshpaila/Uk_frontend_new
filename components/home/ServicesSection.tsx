"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import Container from "@/components/ui/Container";
import ServiceCard from "@/components/ui/ServiceCard";
import SkeletonCard from "@/components/ui/SkeletonCard";
import { fetchServices } from "@/lib/api";
import type { Service } from "@/lib/types";

function serviceMatchesQuery(service: Service, q: string) {
  const query = q.trim().toLowerCase();
  if (!query) return true;

  // Safely check common fields without depending on exact type shape
  const s: any = service;

  const haystack = [
    s?.name,
    s?.title,
    s?.slug,
    s?.description,
    s?.shortDescription,
    s?.category,
    s?.type,
    s?.serviceType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export default function ServicesSection() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await fetchServices();
        if (!cancelled) {
          setServices(data || []);
          if (!data || data.length === 0) {
            toast("No services available yet. Please check back soon.", {
              icon: "🩺",
            });
          }
        }
      } catch (err: any) {
        const msg = err?.message || "Could not load services. Please try again.";
        if (!cancelled) {
          setErrorMsg(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredServices = useMemo(() => {
    if (!q) return services;
    return services.filter((s) => serviceMatchesQuery(s, q));
  }, [services, q]);

  return (
    <section
      id="services"
      className="bg-pharmacy-bg pb-10 pt-4 md:pb-14 md:pt-6"
    >
      <Container>
        <div className="mb-6 text-center">
          <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">
            Your trusted online pharmacy for fast, expert care
          </h2>
          <p className="mt-2 text-xs text-slate-600 md:text-sm">
            How can we help with your health today?
          </p>

          {/* Optional, lightweight feedback (keeps your UI intact) */}
          {!loading && !errorMsg && q && (
            <p className="mt-2 text-[11px] text-slate-500">
              Showing {filteredServices.length} result
              {filteredServices.length === 1 ? "" : "s"} for{" "}
              <span className="font-semibold text-slate-700">“{q}”</span>
            </p>
          )}
        </div>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        )}

        {!loading && errorMsg && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
            <p className="font-semibold">We couldn&apos;t load services.</p>
            <p className="mt-1">{errorMsg}</p>
          </div>
        )}

        {!loading && !errorMsg && services.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-600">
            No services available at the moment. Please check again later or
            contact the pharmacy directly.
          </div>
        )}

        {!loading && !errorMsg && services.length > 0 && filteredServices.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-4 text-center text-xs text-slate-600">
            No services matched <span className="font-semibold">“{q}”</span>. Try a
            different keyword.
          </div>
        )}

        {!loading && !errorMsg && filteredServices.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filteredServices.map((service) => (
              <ServiceCard key={(service as any).id ?? (service as any)._id} service={service} />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
