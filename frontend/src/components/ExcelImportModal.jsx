    import { useEffect, useMemo, useState } from "react";
    import importService from "../services/importService";


    const validateRows = (rows) => {
      const seen = new Map();
      const errors = new Map();

      rows.forEach((row) => {
        const excelRow = row.excelRow;
        const hasData = [row.doc, row.name, row.username, row.job, row.rangeChangeDate, row.phone, row.email].some(Boolean);
        if (!hasData) {
          errors.set(excelRow, "La fila está completamente vacía.");
          return;
        }

        if (row.doc) {
          const previous = seen.get(row.doc);
          if (previous) {
            const message = `El DNI ${row.doc} está repetido. Corrige uno de los registros.`;
            errors.set(excelRow, message);
            errors.set(previous, message);
          } else {
            seen.set(row.doc, excelRow);
          }
        }
      });

      return rows.map((row) => ({
        ...row,
        status: errors.has(row.excelRow) ? "error" : "ok",
        error: errors.get(row.excelRow) || "",
      }));
    };

    const ExcelImportModal = ({ file, circles, onClose, onCompleted }) => {
      const [rows, setRows] = useState([]);
      const [recognizedColumns, setRecognizedColumns] = useState([]);
      const [headerRow, setHeaderRow] = useState(1);
      const [targetCircle, setTargetCircle] = useState("");
      const [loading, setLoading] = useState(true);
      const [saving, setSaving] = useState(false);
      const [error, setError] = useState("");
      const [editingRow, setEditingRow] = useState(null);
      const [showInstructions, setShowInstructions] = useState(false);

      useEffect(() => {
        let cancelled = false;

        (async () => {
          try {
            setLoading(true);
            setError("");
            const result = await importService.previewUsers(file);
            if (cancelled) return;
            setRows(validateRows(result.rows || result.validRows || []));
            setRecognizedColumns(result.recognizedColumns || []);
            setHeaderRow(result.headerRow || 1);
          } catch (err) {
            if (!cancelled) setError(err?.message || "No se pudo leer el archivo Excel.");
          } finally {
            if (!cancelled) setLoading(false);
          }
        })();

        return () => { cancelled = true; };
      }, [file]);

      const errorRows = useMemo(() => rows.filter((row) => row.status === "error"), [rows]);
      const validRows = useMemo(() => rows.filter((row) => row.status === "ok"), [rows]);



      const startEditing = (row) => {
        setEditingRow({ ...row });
        setError("");
      };

      const saveEditing = () => {
        if (!editingRow) return;
        setRows((current) => validateRows(current.map((row) => (
          row.excelRow === editingRow.excelRow ? { ...editingRow } : row
        ))));
        setEditingRow(null);
      };

      const processImport = async () => {
        if (!targetCircle) {
          setError("Selecciona a qué círculo pertenecen estos datos.");
          return;
        }

        const checkedRows = validateRows(rows);
        setRows(checkedRows);

        if (checkedRows.some((row) => row.status === "error")) {
          setError("Corrige los registros marcados antes de guardar.");
          return;
        }

        try {
          setSaving(true);
          setError("");
          const cleanRows = checkedRows.map(({ status, error: rowError, ...row }) => row);
          const result = await importService.commitUsers(cleanRows, targetCircle);
          await onCompleted(result);
        } catch (err) {
          setError(err?.message || "No se pudo importar el archivo.");
        } finally {
          setSaving(false);
        }
      };

      return (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onMouseDown={onClose}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-[850px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">📊 Carga Masiva de Miembros desde Excel</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">Revisa y corrige los datos antes de guardarlos.</p>
              </div>
              <button type="button" onClick={onClose} className="text-xl text-slate-400 hover:text-slate-600">×</button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              <div className="mb-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
                <div className="text-xs font-bold text-slate-700">📄 {file?.name}</div>
                <div className="mt-1 text-[11px] leading-5 text-slate-500">
                  Columnas reconocidas: {recognizedColumns.length ? recognizedColumns.join(", ") : "ninguna todavía"}.
                  {headerRow > 1 && <span> Encabezados encontrados en la fila {headerRow}.</span>}
                </div>
                <button
                  type="button"
                  onClick={() => setShowInstructions((value) => !value)}
                  className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                >
                  {showInstructions ? "Ocultar formato recomendado" : "¿Cómo debe ser el Excel?"}
                </button>
              </div>

              {showInstructions && (
                <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-900">
                  <div className="font-bold">Formato recomendado</div>
                  <div className="mt-1 leading-5">
                    <b>Nombre · DNI · Usuario · Círculo Asignado · Rango · Fecha de Cambio de Rango · Número de Teléfono · Correo</b>.
                    El Círculo Asignado del archivo es solo informativo: el círculo real se elige abajo.
                    No necesitas usar exactamente estos nombres; el sistema intenta reconocer equivalentes comunes y toma únicamente los datos que puede utilizar.
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex h-56 items-center justify-center text-sm font-semibold text-slate-500">⏳ Leyendo archivo...</div>
              ) : error && !rows.length ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800">{rows.length} registros encontrados</span>
                    {errorRows.length > 0 ? (
                      <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">{errorRows.length} necesitan corrección</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800">Todos listos para guardar</span>
                    )}
                  </div>

                  <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
                    <label className="mb-1 block text-xs font-bold text-indigo-900">Círculo destino <span className="text-rose-500">*</span></label>
                    <select value={targetCircle} onChange={(e) => setTargetCircle(e.target.value)} className="h-10 w-full rounded-lg border border-indigo-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500">
                      <option value="">Seleccione un círculo</option>
                      {circles.map((circle) => <option key={circle._id || circle.name} value={circle.name}>{circle.name}</option>)}
                    </select>
                    <p className="mt-1.5 text-[11px] text-indigo-700">⚠️ Todos los registros se asignarán al círculo elegido aquí. El valor “Círculo” del Excel no cambia esta selección.</p>
                  </div>

                  {errorRows.length > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-bold text-amber-900">⚠️ Revisión necesaria</div>
                      <div className="mt-1 text-[11px] text-amber-800">Elige una fila y pulsa <b>Corregir</b>. Cuando todos los conflictos estén resueltos, podrás guardar todo de golpe.</div>
                      <div className="mt-2 space-y-1">
                        {errorRows.map((row) => (
                          <div key={row.excelRow} className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-[11px]">
                            <span><b>Fila {row.excelRow}</b> · {row.name || "Sin nombre"} · DNI {row.doc || "—"}<span className="ml-1 text-amber-700">— {row.error}</span></span>
                            <button type="button" onClick={() => startEditing(row)} className="shrink-0 rounded-md bg-amber-500 px-2.5 py-1 font-bold text-white hover:bg-amber-600">✏️ Corregir</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="max-h-[330px] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[760px] text-left text-xs text-slate-600">
                      <thead className="sticky top-0 z-10 bg-slate-100 font-semibold">
                        <tr>
                          <th className="p-2">#</th>
                          <th className="p-2">DNI</th>
                          <th className="p-2">Nombre</th>
                          <th className="p-2">Usuario</th>
                          <th className="p-2">Rango</th>
                          <th className="p-2">Fecha cambio</th>
                          <th className="p-2">Teléfono</th>
                          <th className="p-2">Correo</th>
                          <th className="p-2">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {rows.map((row) => (
                          <tr key={row.excelRow} className={row.status === "error" ? "bg-amber-50" : ""}>
                            <td className="p-2 font-semibold">{row.excelRow}</td>
                            <td className="p-2 font-bold text-emerald-700">{row.doc || "—"}</td>
                            <td className="p-2 font-semibold">{row.name || "—"}</td>
                            <td className="p-2">{row.username || "—"}</td>
                            <td className="p-2">{row.job || "—"}</td>
                            <td className="p-2">{row.rangeChangeDate || "—"}</td>
                            <td className="p-2">{row.phone || "—"}</td>
                            <td className="p-2">{row.email || "—"}</td>
                            <td className="p-2">
                              {row.status === "error" ? (
                                <button type="button" onClick={() => startEditing(row)} className="rounded-md bg-amber-500 px-2 py-1 text-[10px] font-bold text-white">Corregir</button>
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">✓ Listo</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {error && <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</div>}
                </>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
              <div className="text-[11px] text-slate-500">
                {validRows.length} de {rows.length} registros listos
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700">Cancelar</button>
                <button type="button" onClick={processImport} disabled={loading || saving || !rows.length || errorRows.length > 0} className="h-10 rounded-lg bg-emerald-500 px-4 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                  {saving ? "Guardando..." : "Guardar todo en Base de Datos"}
                </button>
              </div>
            </div>
          </div>

          {editingRow && (
            <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-950/45 p-4" onMouseDown={() => setEditingRow(null)}>
              <div className="w-full max-w-[620px] rounded-2xl bg-white p-5 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">✏️ Corregir registro · fila {editingRow.excelRow}</h4>
                    <p className="mt-1 text-[11px] text-slate-500">Corrige solo el dato necesario y luego guarda los cambios.</p>
                  </div>
                  <button type="button" onClick={() => setEditingRow(null)} className="text-lg text-slate-400">×</button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    ["doc", "DNI"],
                    ["name", "Nombre completo"],
                    ["username", "Usuario"],
                    ["job", "Rango"],
                    ["rangeChangeDate", "Fecha de Cambio de Rango"],
                    ["phone", "Número de Teléfono"],
                    ["email", "Correo"],
                  ].map(([field, label]) => (
                    <label key={field} className="text-[11px] font-bold text-slate-700">
                      {label}
                      <input
                        type={field === "rangeChangeDate" ? "date" : "text"}
                        value={editingRow[field] || ""}
                        onChange={(e) => setEditingRow((current) => ({ ...current, [field]: e.target.value }))}
                        className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                      />
                    </label>
                  ))}
                </div>

                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                  <b>Círculo en archivo:</b> {editingRow.circle || "—"}. Este valor es informativo y no modifica el círculo destino elegido en la pantalla principal.
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setEditingRow(null)} className="h-9 rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-700">Cancelar</button>
                  <button type="button" onClick={saveEditing} className="h-9 rounded-lg bg-indigo-600 px-4 text-xs font-bold text-white">Guardar corrección</button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    };

    export default ExcelImportModal;
