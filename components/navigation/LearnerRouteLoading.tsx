import { neueHaas } from "@/app/fonts";

export function LearnerRouteLoading({
  message = "Opening page...",
}: {
  message?: string;
}) {
  return (
    <main
      className={`${neueHaas.className} min-h-screen bg-gradient-to-b from-[#EEF7FF] to-[#FFF8E6] p-6 pb-12`}
    >
      <div className="mx-auto max-w-md">
        <div className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 animate-pulse rounded-full bg-[#508DB1]"
            />
            <p className="text-sm font-semibold text-slate-700">{message}</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default LearnerRouteLoading;
