import { useEffect, useState } from "react";
import importService from "../services/importService";

const ExcelImportModal = ({ file, circles, onClose, onCompleted }) => {
  const [preview, setPreview] = useState(null);
  const [targetCircle, setTargetCircle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const result = await importService.previewUsers(file);
        if (!cancelled) setPreview(result);
      } catch (err) {
        if (!cancelled) setError(err?.message || "No se pudo leer el archivo Excel.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  const processImport = async () => {
    if (!targetCircle) {
      setError("Selecciona a qué círculo pertenecen estos datos.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const result = await importService.uploadUsers(file, targetCircle);
      await onCompleted(result);
    } catch (err) {
      setError(err?.message || "No se pudo importar el archivo.");
    } finally {
      setSaving(false);
    }
  };

  const rows = preview?.validRows || [];
  const errors = preview?.errors || [];

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-[650px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">📊 Carga Masiva de Miembros desde Excel</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="flex-1 overflow-hidden p-5">
          <div className="mb-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
            <div className="text-xs font-bold text-slate-700">📄 {file?.name}</div>
            <div className="mt-1 text-[11px] text-slate-500">Columnas reconocidas: DNI, NOMBRE Y APELLIDO, RANGO, CIRCULO, CORREO, CELULAR. No es necesario que todas estén completas.</div>
          </div>

          {loading ? (
            <div className="flex h-56 items-center justify-center text-sm font-semibold text-slate-500">⏳ Leyendo archivo...</div>
          ) : error && !preview ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
          ) : (
            <>
              <div className="mb-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{rows.length} filas válidas encontradas</div>

              <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                <label className="mb-1 block text-xs font-bold text-indigo-900">Círculo destino <span className="text-rose-500">*</span></label>
                <select value={targetCircle} onChange={(e) => setTargetCircle(e.target.value)} className="h-10 w-full rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Seleccione un círculo</option>
                  {circles.map((circle) => <option key={circle._id || circle.name} value={circle.name}>{circle.name}</option>)}
                </select>
                <p className="mt-1.5 text-[11px] text-indigo-700">⚠️ Los miembros nuevos serán asignados al círculo elegido aquí. El sistema no realiza asignaciones automáticas ni crea círculos nuevos, aunque el Excel traiga una columna “Círculo”.</p>
              </div>

              <div className="max-h-52 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="sticky top-0 bg-slate-100 font-semibold">
                    <tr><th className="p-2">#</th><th className="p-2">DNI</th><th className="p-2">Nombre</th><th className="p-2">Rango</th><th className="p-2">Círculo (en archivo)</th><th className="p-2">Email</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((u, i) => <tr key={`${u.doc}-${i}`}><td className="p-2">{i + 1}</td><td className="p-2 font-bold text-emerald-700">{u.doc}</td><td className="p-2 font-semibold">{u.name}</td><td className="p-2">{u.job || "—"}</td><td className="p-2"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">{u.circle || "—"}</span></td><td className="p-2">{u.email || "—"}</td></tr>)}
                  </tbody>
                </table>
              </div>
              {errors.length > 0 && <p className="mt-2 text-[11px] text-amber-700">⚠️ {errors.length} filas tienen observaciones y no se procesarán.</p>}
              {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700">Cancelar</button>
          <button type="button" onClick={processImport} disabled={loading || saving || !preview?.validRows?.length} className="h-10 rounded-lg bg-emerald-500 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Guardando..." : "Guardar en Base de Datos"}</button>
        </div>
      </div>
    </div>
  );
};

export default ExcelImportModal;
