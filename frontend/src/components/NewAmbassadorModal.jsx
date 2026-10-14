import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Search,
  ShieldCheck,
  UserRoundPlus,
  X,
} from "lucide-react";

import userService from "../services/userService";

const getNextMonthLabel = (dateValue) => {
  if (!dateValue) return "—";

  const date = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";

  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  return new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(next);
};

const NewAmbassadorModal = ({ onClose, onSaved }) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [admissionDate, setAdmissionDate] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (search.trim().length < 2 || selectedUser) {
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        setError("");
        const data = await userService.getUsers({
          search: search.trim(),
          page: 1,
          limit: 10,
        });
        setResults(data.users || []);
      } catch (err) {
        setError(err?.message || "No se pudieron buscar miembros.");
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [search, selectedUser]);

  const handleSave = async () => {
    if (!selectedUser?._id) {
      setError("Selecciona un miembro del Directorio.");
      return;
    }

    if (!admissionDate) {
      setError("Selecciona la fecha de ingreso como embajador.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await userService.registerNewAmbassador(
        selectedUser._id,
        admissionDate
      );
      await onSaved?.(response);
      onClose();
    } catch (err) {
      setError(err?.message || "No se pudo registrar al embajador nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[620px] overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-white to-blue-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2457c5] text-white shadow-md">
              <UserRoundPlus size={20} />
            </div>
            <div>
              <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#2457c5]">
                Periodo de prueba
              </span>
              <h2 className="mt-1 text-lg font-extrabold text-slate-900">
                Embajador nuevo
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Busca un miembro existente y registra únicamente su fecha de ingreso como embajador.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label className="mb-2 block text-xs font-bold text-slate-700">
              Buscar miembro
            </label>

            {selectedUser ? (
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold text-slate-900">
                    {selectedUser.name || "Sin nombre"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    {selectedUser.doc && <span>DNI {selectedUser.doc}</span>}
                    {selectedUser.username && <span>@{selectedUser.username}</span>}
                    {selectedUser.email && <span>{selectedUser.email}</span>}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setSearch("");
                  }}
                  className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[11px] font-bold text-blue-700"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="DNI, nombre, usuario o correo..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
                />

                {(searching || results.length > 0) && (
                  <div className="absolute left-0 right-0 top-[48px] z-20 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                    {searching ? (
                      <div className="px-3 py-4 text-center text-xs text-slate-400">
                        Buscando...
                      </div>
                    ) : (
                      results.map((user) => (
                        <button
                          key={user._id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(user);
                            setResults([]);
                          }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-50"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-slate-800">
                              {user.name || "Sin nombre"}
                            </div>
                            <div className="mt-0.5 truncate text-[10px] text-slate-400">
                              {user.doc || "Sin DNI"} · {user.username || "Sin usuario"} · {user.email || "Sin correo"}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">
                            {user.circle}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-700">
              <CalendarDays size={15} className="text-slate-400" />
              Fecha de ingreso como embajador
            </label>
            <input
              type="date"
              value={admissionDate}
              onChange={(event) => setAdmissionDate(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-blue-800">
                <ShieldCheck size={15} />
                Inicio de evaluación
              </div>
              <p className="mt-2 text-sm font-bold capitalize text-slate-800">
                {getNextMonthLabel(admissionDate)}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                El mes de ingreso no participa en el periodo de prueba.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
                <CheckCircle2 size={15} />
                Requisito
              </div>
              <p className="mt-2 text-sm font-bold text-slate-800">
                3 meses consecutivos
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Asistencia perfecta incluyendo justificaciones válidas.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedUser || !admissionDate}
              className="h-10 rounded-xl bg-[#2457c5] px-5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#1d49a6] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Registrando..." : "Registrar embajador"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewAmbassadorModal;
