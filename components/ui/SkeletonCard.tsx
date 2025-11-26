export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 shadow-soft-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-24 rounded-full bg-slate-200" />
        <div className="h-6 w-6 rounded-full bg-slate-200" />
      </div>
      <div className="mb-2 h-4 w-40 rounded-full bg-slate-200" />
      <div className="mb-2 h-3 w-full rounded-full bg-slate-200" />
      <div className="mb-2 h-3 w-4/5 rounded-full bg-slate-200" />
      <div className="mt-3 flex items-center justify-between">
        <div className="h-4 w-16 rounded-full bg-slate-200" />
        <div className="h-7 w-20 rounded-full bg-slate-200" />
      </div>
    </div>
  );
}
