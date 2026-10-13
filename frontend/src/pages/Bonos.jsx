import { useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  SearchCheck,
  UploadCloud,
  UserCheck,
  UserX,
} from "lucide-react";

import bonusService from "../services/bonusService";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const shiftMonth = (year, month, offset) => {
  const date = new Date(year, month - 1 + offset, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
};

const Bonos = () => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const evaluated = useMemo(() => shiftMonth(year, month, -3), [year, month]);

  const handlePreview = async () => {
    if (!file) {
      setError("Selecciona el archivo Excel de bonos.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await bonusService.preview(file, year, month);
      setPreview(data);
    } catch (err) {
      setError(err?.message || "No se pudo revisar el archivo.");
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;

    try {
      setDownloading(true);
      setError("");
      await bonusService.download(file, year, month);
    } catch (err) {
      setError(err?.message || "No se pudo descargar el Excel procesado.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px] space-y-5">
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
          <div className="flex flex-col gap-5 bg-gradient-to-r from-white via-white to-blue-50 px-6 py-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2457c5] to-[#102657] text-white shadow-lg">
                <BadgeDollarSign size={23} />
              </div>
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#2457c5]">
                  Gestión de incentivos
                </span>
                <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-slate-900">
                  Bonos
                </h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                  Sube el formato mensual y SEINFINITY verificará la asistencia, las justificaciones válidas y el periodo de prueba de cada embajador.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-sm">
              <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                Regla aplicada
              </div>
              <div className="mt-1 text-xs font-extrabold text-slate-800">
                Pago {MONTHS[month - 1]} → evalúa {MONTHS[evaluated.month - 1]}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[370px_minmax(0,1fr)]">
          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-[#2457c5]">
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">Procesar archivo</h2>
                <p className="text-[11px] text-slate-500">Selecciona mes de pago y Excel.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] font-bold text-slate-600">
                  Mes de pago
                  <select
                    value={month}
                    onChange={(event) => {
                      setMonth(Number(event.target.value));
                      setPreview(null);
                    }}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                  >
                    {MONTHS.map((label, index) => (
                      <option key={label} value={index + 1}>{label}</option>
                    ))}
                  </select>
                </label>

                <label className="text-[11px] font-bold text-slate-600">
                  Año
                  <input
                    type="number"
                    value={year}
                    onChange={(event) => {
                      setYear(Number(event.target.value));
                      setPreview(null);
                    }}
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-wide text-amber-700">
                  Mes de asistencia evaluado
                </div>
                <div className="mt-1 text-sm font-extrabold text-slate-900">
                  {MONTHS[evaluated.month - 1]} {evaluated.year}
                </div>
              </div>

              <label className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 p-4 text-center transition hover:bg-blue-50">
                <UploadCloud size={22} className="text-[#2457c5]" />
                <span className="mt-2 text-xs font-extrabold text-slate-800">
                  {file ? file.name : "Seleccionar Excel"}
                </span>
                <span className="mt-1 text-[10px] text-slate-400">.xlsx o .xls</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(event) => {
                    setFile(event.target.files?.[0] || null);
                    setPreview(null);
                    setError("");
                  }}
                />
              </label>

              <button
                type="button"
                onClick={handlePreview}
                disabled={loading || !file}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2457c5] text-xs font-extrabold text-white shadow-sm transition hover:bg-[#1d49a6] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SearchCheck size={16} />
                {loading ? "Revisando..." : "Revisar elegibilidad"}
              </button>
            </div>
          </div>

          <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            {!preview ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <BadgeDollarSign size={24} />
                </div>
                <h3 className="mt-4 text-sm font-extrabold text-slate-800">Aún no hay una revisión</h3>
                <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">
                  Cuando cargues el Excel verás cuántos usuarios reciben bono, cuántos no cumplen y cuáles no pudieron encontrarse.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Resultado</span>
                    <h2 className="mt-1 text-base font-extrabold text-slate-900">
                      Bono de {MONTHS[preview.evaluated.month - 1]} {preview.evaluated.year}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Download size={15} />
                    {downloading ? "Generando..." : "Descargar Excel"}
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <UserCheck size={17} className="text-slate-500" />
                    <div className="mt-3 text-2xl font-extrabold text-slate-900">{preview.summary.total}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Usuarios Excel</div>
                  </div>
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <CheckCircle2 size={17} className="text-emerald-600" />
                    <div className="mt-3 text-2xl font-extrabold text-emerald-700">{preview.summary.eligible}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Reciben bono</div>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                    <UserX size={17} className="text-rose-500" />
                    <div className="mt-3 text-2xl font-extrabold text-rose-700">{preview.summary.notEligible}</div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-rose-500">Sin bono</div>
                  </div>
                </div>

                <div className="mt-5 max-h-[280px] overflow-y-auto rounded-xl border border-slate-200">
                  {preview.rows.map((row, index) => (
                    <div
                      key={`${row.username}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_100px] items-center gap-3 border-b border-slate-100 px-3 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-slate-800">{row.username}</div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-400">{row.reason}</div>
                      </div>
                      <span className={`justify-self-end rounded-full px-2.5 py-1 text-[9px] font-extrabold ${row.eligible ? "bg-emerald-100 text-emerald-700" : row.matched ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>
                        {row.eligible ? "BONO" : row.matched ? "NO BONO" : "NO ENCONTRADO"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Bonos;
