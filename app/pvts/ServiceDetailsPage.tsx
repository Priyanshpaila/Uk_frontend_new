"use client";

import { useState, useEffect } from "react";
import { fetchServices } from "@/lib/api";
import { toast } from "react-hot-toast";
import Link from "next/link";
import Image from "next/image";
import { Service } from "@/lib/types";
import { Search, X } from "lucide-react"; // Importing Lucide icons

// Service Card Component (Improved)
const ServiceCard = ({ service }: { service: Service }) => (
  <article className="group flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-lg transition-all duration-300 hover:scale-105 hover:border-cyan-500/80 hover:shadow-xl">
    <div>
      {/* Image */}
      <div className="relative mb-4 h-40 w-full overflow-hidden rounded-2xl bg-slate-100">
        {service.image ? (
          <Image
            src={service.image}
            alt={service.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-slate-400">
            No Image Available
          </div>
        )}
      </div>

      {/* Service details */}
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium">
          {service.viewType === "card" ? "Private Service" : "Service"}
        </span>
        <span
          className={`text-[12px] ${
            service.active ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {service.active ? "Available" : "Temporarily Unavailable"}
        </span>
      </div>

      <h3 className="mb-1 text-lg font-semibold text-slate-900 md:text-base">
        {service.name}
      </h3>
      <p className="mb-3 line-clamp-3 text-sm text-slate-500 md:text-sm">
        {service.description || "No description available."}
      </p>
    </div>

    {/* Bottom Row */}
    <div className="mt-2 flex items-center justify-between gap-3">
      <span
        className={`inline-block px-2 py-1 rounded-full text-xs font-normal 
        ${
          service.appointmentMedium === "online"
            ? "bg-green-100 text-green-600"
            : "bg-yellow-100 text-yellow-600"
        }`}
      >
        {service.appointmentMedium === "online" ? "Online" : "Offline"}
      </span>

      {/* CTA Button */}
      <Link
        href={`/private-services/${encodeURIComponent(service.slug)}`}
        className="inline-flex h-8 min-w-[120px] items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-cyan-800 shadow-sm transition-all group-hover:border-cyan-500 group-hover:bg-cyan-50"
      >
        {service.ctaText || "Book Now"}
      </Link>
    </div>
  </article>
);

// Skeleton Loader Component
const SkeletonCard = () => (
  <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
    <div className="mb-4 h-40 w-full bg-slate-200 rounded-xl" />
    <div className="mb-2 h-6 w-3/4 bg-slate-200 rounded-full" />
    <div className="mb-4 h-3 w-5/6 bg-slate-200 rounded-full" />
    <div className="flex justify-between mt-4">
      <div className="h-8 w-28 bg-slate-200 rounded-full" />
      <div className="h-8 w-28 bg-slate-200 rounded-full" />
    </div>
  </div>
);

export default function ServiceListPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchServices();
        setServices(data);
      } catch (err) {
        setError("Could not load services.");
        toast.error("Error loading services.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Filter services by availability type (online, offline)
  const filteredServices = services
    .filter(
      (service) => filter === "all" || service.appointmentMedium === filter
    )
    .filter((service) =>
      service.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleSearchClear = () => {
    setSearchQuery("");
  };

  return (
    <div className="py-10 mt-28 bg-gray-50">
      <div className="max-w-7xl mx-auto px-6">
        {/* Page Title and Search */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold text-slate-900">
            Explore Our Services
          </h1>
          <p className="mt-2 text-lg text-slate-600">
            Find the best services to suit your needs.
          </p>

          {/* Search Bar with Icons */}
          <div className="mt-4 flex justify-center mb-4 relative w-full max-w-3xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search services by name..."
              className="w-full py-3 pl-12 pr-12 text-lg rounded-full bg-slate-100 border border-slate-300 shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all duration-300"
            />
            <Search
              className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500"
              size={20}
            />
            {searchQuery && (
              <X
                className="absolute right-4 top-1/2 transform -translate-y-1/2 cursor-pointer text-slate-500"
                size={20}
                onClick={handleSearchClear}
              />
            )}
          </div>

          {/* Filters */}
          <div className="mt-4 flex justify-center gap-4">
            <button
              onClick={() => setFilter("all")}
              className={`px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                filter === "all"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-200 text-slate-700 hover:bg-emerald-600 hover:text-white"
              }`}
            >
              All Services
            </button>
            <button
              onClick={() => setFilter("online")}
              className={`px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                filter === "online"
                  ? "bg-green-600 text-white"
                  : "bg-slate-200 text-slate-700 hover:bg-green-600 hover:text-white"
              }`}
            >
              Online
            </button>
            <button
              onClick={() => setFilter("offline")}
              className={`px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200 ${
                filter === "offline"
                  ? "bg-yellow-600 text-white"
                  : "bg-slate-200 text-slate-700 hover:bg-yellow-600 hover:text-white"
              }`}
            >
              Offline
            </button>
          </div>
        </div>

        {/* Error or Loading */}
        {error && <div className="text-center text-red-500">{error}</div>}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {Array.from({ length: 8 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        )}

        {/* Services */}
        {!loading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredServices.length > 0 ? (
              filteredServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))
            ) : (
              <div className="col-span-4 text-center text-slate-500">
                No services available at the moment. Try adjusting the filters
                or search query.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
