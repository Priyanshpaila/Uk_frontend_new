import { Suspense } from "react";
import ProfilePageClient from "./ProfilePageClient";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <section className="bg-pharmacy-bg py-10 md:py-14 min-h-full">
          <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-5 text-xs text-slate-700 shadow-soft-card md:p-7 md:text-sm">
            <p className="text-center text-slate-500 text-sm">
              Loading your profile…
            </p>
          </div>
        </section>
      }
    >
      <ProfilePageClient />
    </Suspense>
  );
}
