"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getUserOrdersApi, type OrderDto } from "@/lib/api";
import toast from "react-hot-toast";
import {
  Package,
  ChevronDown,
  Calendar as CalendarIcon,
  CalendarClock,
  CreditCard,
  MapPin,
  Stethoscope,
} from "lucide-react";
import {
  formatDate,
  formatDateTime,
  formatMoneyFromMinor,
  getUserIdFromUser,
  getUserIdFromToken,
} from "../utils";

export default function OrdersTab() {
  const { user, token } = useAuth();
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const userId = getUserIdFromUser(user) ?? getUserIdFromToken(token);

  useEffect(() => {
    if (!user || !token || !userId) return;

    let cancelled = false;

    async function loadOrders() {
      setOrdersLoading(true);
      setOrdersError(null);
      try {
        // 🔧 non-null assertion is safe because we returned above if !userId
        const res = await getUserOrdersApi(userId!, 1, 20);
        if (!cancelled) {
          setOrders(res.data || []);
        }
      } catch (err: any) {
        const msg =
          err?.message || "Could not load your orders. Please try again.";
        if (!cancelled) {
          console.error("[OrdersTab] error loading orders", err);
          setOrdersError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false);
        }
      }
    }

    loadOrders();
    return () => {
      cancelled = true;
    };
  }, [user, token, userId]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-slate-500" />
        <p className="font-semibold text-slate-900">My orders</p>
      </div>

      {!user ? (
        <p>You need to be logged in to view your orders.</p>
      ) : !userId ? (
        <p className="text-slate-500">
          We couldn&apos;t identify your account. Please refresh and try again.
        </p>
      ) : ordersLoading ? (
        <p className="text-slate-500">Loading your orders…</p>
      ) : ordersError ? (
        <p className="text-rose-600">{ordersError}</p>
      ) : orders.length === 0 ? (
        <p className="text-slate-600">
          You don&apos;t have any orders yet. Once you place an order through
          Pharmacy Express, it will appear here with its status and tracking
          information.
        </p>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const isOpen = openOrderId === order._id;
            const firstLine =
              order.meta?.lines && order.meta.lines.length > 0
                ? order.meta.lines[0]
                : null;

            return (
              <div
                key={order._id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                {/* Accordion header */}
                <button
                  type="button"
                  onClick={() =>
                    setOpenOrderId((prev) =>
                      prev === order._id ? null : order._id
                    )
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {order.reference}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        {order.status}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                        {order.payment_status}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-900">
                      {order.service_name || "Service"} ·{" "}
                      {firstLine
                        ? `${firstLine.name} × ${firstLine.qty}`
                        : "View details"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Placed on {formatDate(order.createdAt)} ·{" "}
                      {formatMoneyFromMinor(order.meta?.totalMinor)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="hidden text-[11px] text-slate-500 sm:inline">
                      {order.start_at
                        ? formatDateTime(order.start_at)
                        : "No appointment booked"}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-[11px] text-slate-600">
                    <div className="grid gap-3 md:grid-cols-[2fr_1.4fr]">
                      {/* Left: items / details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <Stethoscope className="h-3.5 w-3.5 text-slate-500" />
                          <span>Items in this order</span>
                        </div>
                        <ul className="space-y-1.5">
                          {(order.meta?.lines || []).map((line) => (
                            <li
                              key={line.index}
                              className="flex items-center justify-between"
                            >
                              <span className="text-slate-700">
                                {line.name}
                                {line.variation ? ` (${line.variation})` : ""}
                              </span>
                              <span className="text-slate-500">
                                × {line.qty}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Right: appointment / payment / summary */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                          <CalendarClock className="h-3.5 w-3.5 text-slate-500" />
                          <span>Appointment & payment</span>
                        </div>
                        <div className="space-y-1">
                          <p className="flex items-center gap-1.5">
                            <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              Appointment:{" "}
                              {order.start_at
                                ? formatDateTime(order.start_at)
                                : "Not yet booked"}
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              Payment: {order.payment_status} ·{" "}
                              {formatMoneyFromMinor(order.meta?.totalMinor)}
                            </span>
                          </p>
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              Service:{" "}
                              {order.service_name ||
                                order.service_slug ||
                                "Not set"}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
