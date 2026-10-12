import { ChartCandlestick } from "lucide-react";

const MasterclassButton = ({
  onClick,
  loading = false,
  disabled = false,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="group relative inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-xl border border-blue-500/30 bg-gradient-to-r from-[#2457c5] via-[#2b63db] to-[#3975f4] px-4 text-xs font-extrabold text-white shadow-[0_6px_16px_rgba(37,99,235,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_22px_rgba(37,99,235,0.30)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/15 opacity-0 blur-sm transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />

      <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-white/15 text-[11px] ring-1 ring-white/15 transition group-hover:scale-105 group-hover:bg-white/20">
        {loading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        ) : (
          <ChartCandlestick className="h-[14px] w-[14px]" strokeWidth={2} />
        )}
      </span>

      <span className="relative whitespace-nowrap">
        {loading
          ? "Creando Masterclass..."
          : "Crear Masterclass del mes"}
      </span>
    </button>
  );
};

export default MasterclassButton;
