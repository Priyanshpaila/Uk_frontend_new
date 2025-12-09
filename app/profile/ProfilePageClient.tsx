"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Container from "@/components/ui/Container";
import { useAuth } from "@/components/auth/AuthProvider";
import { getLoggedInUserApi, type LoggedInUser } from "@/lib/api";
import { User as UserIcon, Edit2, XCircle } from "lucide-react";
import ProfileTab from "./components/ProfileTab";
import OrdersTab from "./components/OrdersTab";
import ReordersTab from "./components/ReordersTab";

type TabId = "profile" | "orders" | "reorders";

export default function ProfilePageClient() {
  const { user, token, setAuth, initialized } = useAuth();
  const searchParams = useSearchParams();

  // read tab from query ?tab=orders
  const tabFromQuery = searchParams.get("tab");
  const initialTab: TabId =
    tabFromQuery === "orders" || tabFromQuery === "reorders"
      ? (tabFromQuery as TabId)
      : "profile";

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [editing, setEditing] = useState(false);

  // 🔄 Ensure we have user loaded from /users/me when token exists
  useEffect(() => {
    if (!initialized || !token) return;
    if (user) return;

    let cancelled = false;

    (async () => {
      try {
        const me = await getLoggedInUserApi();
        if (cancelled) return;

        // handle both { user: {...} } and plain {...}
        const meUser = (me as any).user ?? me;
        setAuth(meUser as LoggedInUser, token);
      } catch (err: any) {
        if (!cancelled) {
          console.warn("Failed to fetch /users/me:", err?.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialized, token, user, setAuth]);

  const fullName =
    user?.firstName || user?.lastName
      ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
      : "Your profile";

  return (
    <section className="bg-pharmacy-bg py-10 md:py-14 min-h-full">
      <Container>
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 text-xs text-slate-700 shadow-soft-card md:p-7 md:text-sm">
          {/* Header */}
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white md:h-11 md:w-11">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  My account
                </p>
                <h1 className="mt-1 text-lg font-semibold text-slate-900 md:text-xl">
                  {fullName}
                </h1>
                <p className="text-xs text-slate-500">
                  View and manage your personal details and orders.
                </p>
              </div>
            </div>

            {/* Edit button only for Profile tab */}
            {user && activeTab === "profile" && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 hover:border-cyan-400 hover:bg-cyan-50"
              >
                {editing ? (
                  <>
                    <XCircle className="mr-1.5 h-3.5 w-3.5 text-rose-500" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit2 className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
                    Edit details
                  </>
                )}
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="mb-5 flex flex-wrap gap-2 rounded-full bg-slate-50 p-1 text-[11px] text-slate-600">
            {[
              { id: "profile", label: "Profile" },
              { id: "orders", label: "My orders" },
              { id: "reorders", label: "Re-orders" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as TabId)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-center font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow"
                      : "bg-transparent text-slate-600 hover:bg-white"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          {activeTab === "profile" && (
            <ProfileTab editing={editing} setEditing={setEditing} />
          )}

          {activeTab === "orders" && <OrdersTab />}

          {activeTab === "reorders" && <ReordersTab />}
        </div>
      </Container>
    </section>
  );
}
