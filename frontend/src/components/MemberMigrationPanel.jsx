import { useMemo, useState } from "react";

import userService from "../services/userService";
import memberMigrationService from "../services/memberMigrationService";

const getList = (response, keys = []) => {
  if (Array.isArray(response)) return response;

  for (const key of keys) {
    if (Array.isArray(response?.[key])) return response[key];
  }

  return Array.isArray(response?.data) ? response.data : [];
};

const normalizeCircle = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getCircleName = (circle) => {
  if (typeof circle === "string") return circle.trim();
  return String(circle?.name || "").trim();
};

const statusClasses = (status) => {
  if (status === "Asistió" || status === "Clase Presencial") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "Justificado") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
};

const MemberMigrationPanel = ({ circles = [] }) => {
  const [dni, setDni] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [destinationCircle, setDestinationCircle] = useState("");
  const [preview, setPreview] = useState(null);

  const [searchLoading, setSearchLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const originCircle = selectedUser?.circle || "";

  const destinationCircles = useMemo(() => {
    const unique = new Map();

    circles.forEach((circle) => {
      const name = getCircleName(circle);
      if (!name) return;

      if (normalizeCircle(name) === normalizeCircle(originCircle)) {
        return;
      }

      unique.set(normalizeCircle(name), name);
    });

    return Array.from(unique.values());
  }, [circles, originCircle]);

  const clearMigrationSelection = () => {
    setDestinationCircle("");
    setPreview(null);
    setError("");
    setMessage("");
  };

  const handleSearch = async () => {
    const value = dni.trim();

    if (!value) {
      setError("Ingresa el DNI del miembro.");
      setSelectedUser(null);
      setSearched(false);
      clearMigrationSelection();
      return;
    }

    try {
      setSearchLoading(true);
      setError("");
      setMessage("");
      setPreview(null);
      setSelectedUser(null);
      setSearched(true);

      const response = await userService.getUsers({
        search: value,
        page: 1,
        limit: 10,
      });

      const users = getList(response, ["users", "data"]);

      const exactMatch = users.find(
        (user) => String(user?.doc || "").trim() === value
      );

      if (!exactMatch) {
        throw new Error(
          users.length > 1
            ? "Se encontraron varios resultados. Ingresa el DNI completo."
            : "No se encontró ningún miembro con ese DNI."
        );
      }

      setSelectedUser(exactMatch);
      clearMigrationSelection();
    } catch (err) {
      console.error(err);
      setSelectedUser(null);
      setSearched(true);
      setError(err?.message || "No se pudo buscar el miembro.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleDestinationChange = (value) => {
    setDestinationCircle(value);
    setPreview(null);
    setError("");
    setMessage("");
  };

  const handlePreview = async () => {
    if (!selectedUser?._id) {
      setError("Primero busca un miembro por DNI.");
      return;
    }

    if (!destinationCircle) {
      setError("Selecciona el círculo al que será migrado.");
      return;
    }

    try {
      setPreviewLoading(true);
      setError("");
      setMessage("");
      setPreview(null);

      const response = await memberMigrationService.preview({
        userId: selectedUser._id,
        destinationCircle,
      });

      setPreview(response);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo preparar la convalidación.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleMigrate = async () => {
    if (!preview || !selectedUser?._id || !destinationCircle) return;

    const confirmed = window.confirm(
      `¿Confirmas migrar a ${destinationCircle}? Se copiarán sus asistencias, faltas y justificaciones a las sesiones equivalentes por número. El historial original no se eliminará.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await memberMigrationService.migrate({
        userId: selectedUser._id,
        destinationCircle,
      });

      setMessage(
        `${response.message || "Migración realizada correctamente."} Sesiones convalidadas: ${response.migratedSessions || 0}.`
      );

      setSelectedUser(null);
      setSearched(false);
      setDni("");
      setDestinationCircle("");
      setPreview(null);
    } catch (err) {
      console.error(err);
      setError(err?.message || "No se pudo realizar la migración.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-sm font-bold text-slate-900">
          Migraciones de miembros
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Busca al miembro por DNI y selecciona únicamente el círculo al que será migrado. Sus asistencias, faltas y justificaciones se convalidan automáticamente por número de sesión.
        </p>
      </div>

      <div className="space-y-5 p-5">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-600">
              DNI del miembro
            </label>
            <input
              value={dni}
              onChange={(event) => {
                setDni(event.target.value.replace(/\D/g, ""));
                setSearched(false);
                setSelectedUser(null);
                clearMigrationSelection();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
              inputMode="numeric"
              maxLength={20}
              placeholder="Ingresa el DNI"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSearch}
              disabled={searchLoading || !dni.trim()}
              className="h-11 rounded-xl bg-[#2457c5] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#1d49a6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {searchLoading ? "Buscando..." : "Buscar miembro"}
            </button>
          </div>
        </div>

        {searched && selectedUser && (
          <>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-blue-600">
                Miembro encontrado
              </div>

              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[11px] font-semibold text-slate-400">
                    Nombre
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-800">
                    {selectedUser.name || "Sin nombre"}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-400">
                    DNI
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-700">
                    {selectedUser.doc || dni}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-semibold text-slate-400">
                    Círculo actual
                  </div>
                  <div className="mt-1 text-sm font-bold text-slate-700">
                    {originCircle || "Sin círculo"}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-600">
                Círculo de destino
              </label>
              <select
                value={destinationCircle}
                onChange={(event) =>
                  handleDestinationChange(event.target.value)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Seleccionar círculo...</option>
                {destinationCircles.map((circle) => (
                  <option key={circle} value={circle}>
                    {circle}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading || !destinationCircle}
                className="h-10 rounded-xl bg-[#2457c5] px-5 text-sm font-bold text-white shadow-sm hover:bg-[#1d49a6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {previewLoading ? "Preparando..." : "Ver convalidación"}
              </button>
            </div>

            {preview && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Vista previa de la convalidación
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {originCircle} → {destinationCircle}
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-500">
                    {preview.rows?.length || 0} sesiones con asistencia registrada
                  </div>
                </div>

                {preview.rows?.length ? (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-xs">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 font-bold text-slate-500">
                            Sesión
                          </th>
                          <th className="px-3 py-2 font-bold text-slate-500">
                            Origen
                          </th>
                          <th className="px-3 py-2 font-bold text-slate-500">
                            Destino
                          </th>
                          <th className="px-3 py-2 font-bold text-slate-500">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr
                            key={`${row.sessionNumber}-${row.originMeeting?._id}`}
                            className="border-b border-slate-100 last:border-b-0"
                          >
                            <td className="px-3 py-2 font-bold text-slate-700">
                              {row.sessionNumber}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {row.originMeeting?.date || "—"}
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {row.destinationMeeting?.date || "Sin sesión equivalente"}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex rounded-full border px-2 py-1 font-bold ${statusClasses(
                                  row.status
                                )}`}
                              >
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm text-slate-500">
                    No hay asistencias, faltas o justificaciones registradas para convalidar.
                  </div>
                )}

                {preview.missingDestinationSessions > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                    Faltan {preview.missingDestinationSessions} sesiones equivalentes en el círculo de destino. La migración no se ejecutará hasta que todas las sesiones necesarias puedan convalidarse.
                  </div>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={handleMigrate}
                    disabled={
                      saving ||
                      preview.missingDestinationSessions > 0
                    }
                    className="h-10 rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Migrando..." : "Confirmar migración"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default MemberMigrationPanel;
