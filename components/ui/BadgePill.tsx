import type { ReactNode } from "react";

export default function BadgePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/80 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-900 shadow-sm">
      {children}
    </span>
  );
}
