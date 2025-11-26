"use client";

import { Repeat } from "lucide-react";

export default function ReordersTab() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
      <div className="mb-2 flex items-center gap-2">
        <Repeat className="h-4 w-4 text-slate-500" />
        <p className="font-semibold text-slate-900">Re-orders</p>
      </div>
      <p className="mt-1">
        Your repeating treatments and quick reorder options will show here. You
        can return later to reorder weight management or other treatments that
        your prescriber has approved.
      </p>
    </div>
  );
}
