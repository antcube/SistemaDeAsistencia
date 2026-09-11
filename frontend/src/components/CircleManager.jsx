import { useEffect, useState } from "react";
import circleService from "../services/circleService";
import { useAuth } from "../context/AuthContext";

const CircleManager = ({ onClose, onCirclesChanged }) => {
  const { admin } = useAuth();
  const [circles, setCircles] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isMainAdmin = String(admin?.adminId || "").trim() === "ADM-001";

  const loadCircles = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await circleService.getCircles();
      setCircles(Array.isArray(data) ? data : data?.circles || []);
    } catch (err) {
      setError(err?.message || "No se pudieron cargar los círculos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMainAdmin) loadCircles();
  }, [isMainAdmin]);

  const createCircle = async (event) => {
    event.preventDefault();
    const cleanName = name.trim();

    if (!cleanName) {
      setError("Escribe el nombre del círculo.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await circleService.createCircle({ name: cleanName });

      setName("");
      setMessage(`Círculo "${cleanName}" creado correctamente.`);
      await loadCircles();
      await onCirclesChanged?.();
    } catch (err) {
      setError(err?.message || "No se pudo crear el círculo.");
    } finally {
      setSaving(false);
    }
  };

  const deactivateCircle = async (circle) => {
    if (!isMainAdmin) return;

    const confirmed = window.confirm(
      `¿Deseas desactivar el círculo "${circle.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      await circleService.deleteCircle(circle._id);
      setMessage(`Círculo "${circle.name}" desactivado.`);
      await loadCircles();
      await onCirclesChanged?.();
    } catch (err) {
      setError(err?.message || "No se pudo desactivar el círculo.");
    }
  };

  if (!isMainAdmin) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[680px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <span className="text-[10px] font-extrabold tracking-wider text-violet-600">
              ADMINISTRADOR PRINCIPAL
            </span>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Gestionar Círculos
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Crea y administra los círculos disponibles en el sistema.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-2xl leading-none text-slate-500 hover:bg-slate-50 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {message && (
            <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <form onSubmit={createCircle} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <label className="block text-[11px] font-bold text-slate-600">
              Nombre del nuevo círculo
            </label>

            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. PRESENCIAL - LIMA 1"
                disabled={saving}
                className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />

              <button
                type="submit"
                disabled={saving}
                className="h-10 rounded-lg border border-blue-700 bg-gradient-to-r from-blue-600 to-blue-800 px-5 text-xs font-bold text-white shadow-sm hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Creando..." : "+ Crear círculo"}
              </button>
            </div>
          </form>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Círculos existentes</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">
                {circles.length} total
              </span>
            </div>

            {loading ? (
              <div className="rounded-xl border border-slate-200 p-6 text-center text-xs text-slate-500">
                Cargando círculos...
              </div>
            ) : circles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
                Todavía no hay círculos registrados.
              </div>
            ) : (
              <div className="space-y-2">
                {circles.map((circle) => (
                  <div
                    key={circle._id || circle.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-slate-800">
                        {circle.name}
                      </div>
                      <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                        {circle.active === false ? "Inactivo" : "Activo"}
                      </div>
                    </div>

                    {circle.active !== false && (
                      <button
                        type="button"
                        onClick={() => deactivateCircle(circle)}
                        className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                      >
                        Desactivar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircleManager;
