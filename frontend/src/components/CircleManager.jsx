import { useEffect, useState } from "react";
import circleService from "../services/circleService";
import userService from "../services/userService";
import { useAuth } from "../context/AuthContext";

const CircleManager = ({ onClose, onCirclesChanged }) => {
  const { admin } = useAuth();
  const [circles, setCircles] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedCircle, setSelectedCircle] = useState(null);
  const [circleMembers, setCircleMembers] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [deletingMembers, setDeletingMembers] = useState(false);

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

  const deleteCircle = async (circle) => {
    if (!isMainAdmin) return;

    const confirmed = window.confirm(
      `¿Deseas eliminar el círculo "${circle.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      await circleService.deleteCircle(circle._id);

      setMessage(`Círculo "${circle.name}" eliminado correctamente.`);

      await loadCircles();
      await onCirclesChanged?.();
    } catch (err) {
      setError(err?.message || "No se pudo eliminar el círculo.");
    }
  };

  const openMembersManager = async (circle) => {
    if (!isMainAdmin || !circle?.name) return;

    try {
      setSelectedCircle(circle);
      setSelectedMemberIds([]);
      setCircleMembers([]);
      setError("");
      setMessage("");
      setLoadingMembers(true);

      const response = await userService.getUsers({
        circle: circle.name,
        page: 1,
        limit: 200,
      });

      setCircleMembers(
        Array.isArray(response?.users)
          ? response.users
          : []
      );
    } catch (err) {
      setError(
        err?.message ||
          "No se pudieron cargar los miembros del círculo."
      );
    } finally {
      setLoadingMembers(false);
    }
  };

  const closeMembersManager = () => {
    if (deletingMembers) return;

    setSelectedCircle(null);
    setCircleMembers([]);
    setSelectedMemberIds([]);
    setError("");
    setMessage("");
  };

  const toggleMember = (memberId) => {
    setSelectedMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  };

  const toggleAllMembers = () => {
    if (!circleMembers.length) return;

    if (selectedMemberIds.length === circleMembers.length) {
      setSelectedMemberIds([]);
      return;
    }

    setSelectedMemberIds(
      circleMembers.map((member) => member._id)
    );
  };

  const deleteSelectedMembers = async () => {
    if (
      !selectedCircle ||
      !selectedMemberIds.length ||
      deletingMembers
    ) {
      return;
    }

    const selectedMembers = circleMembers.filter((member) =>
      selectedMemberIds.includes(member._id)
    );

    const previewNames = selectedMembers
      .slice(0, 5)
      .map((member) => member.name)
      .join(", ");

    const extraCount = selectedMembers.length - 5;

    const preview =
      extraCount > 0
        ? `${previewNames} y ${extraCount} más`
        : previewNames;

    const confirmed = window.confirm(
      `¿Eliminar ${selectedMembers.length} miembro(s) del círculo "${selectedCircle.name}"?\n\n${preview}\n\nEl círculo permanecerá intacto y sus reuniones no serán eliminadas.`
    );

    if (!confirmed) return;

    try {
      setDeletingMembers(true);
      setError("");
      setMessage("");

      for (const memberId of selectedMemberIds) {
        await userService.deleteUser(memberId);
      }

      setMessage(
        `${selectedMemberIds.length} miembro(s) eliminado(s) del círculo "${selectedCircle.name}". El círculo permanece intacto.`
      );

      await openMembersManager(selectedCircle);
      await onCirclesChanged?.();
    } catch (err) {
      setError(
        err?.message ||
          "No se pudieron eliminar todos los miembros seleccionados."
      );
    } finally {
      setDeletingMembers(false);
    }
  };

  if (!isMainAdmin) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-[760px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <span className="text-[10px] font-extrabold tracking-wider text-violet-600">
              ADMINISTRADOR PRINCIPAL
            </span>

            <h2 className="mt-1 text-lg font-bold text-slate-900">
              Gestionar Círculos
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Crea, administra y gestiona los miembros de cada círculo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving || deletingMembers}
            className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-2xl leading-none text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
          >
            ×
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {message && (
            <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}

          {!selectedCircle ? (
            <>
              <form
                onSubmit={createCircle}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
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
                    className="h-10 rounded-lg border border-blue-700 bg-gradient-to-r from-blue-600 to-blue-800 px-5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "Creando..." : "+ Crear círculo"}
                  </button>
                </div>
              </form>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    Círculos existentes
                  </h3>

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
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-slate-800">
                            {circle.name}
                          </div>

                          <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                            {circle.active === false
                              ? "Inactivo"
                              : "Activo"}
                          </div>
                        </div>

                        {circle.active !== false && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                openMembersManager(circle)
                              }
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold text-blue-700 transition hover:bg-blue-100"
                            >
                              👥 Eliminar miembros
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                deleteCircle(circle)
                              }
                              disabled={saving || deletingMembers}
                              className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-[10px] font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              Eliminar círculo
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div>
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={closeMembersManager}
                    disabled={deletingMembers}
                    className="mb-2 text-[10px] font-bold text-blue-700 hover:text-blue-900"
                  >
                    ← Volver a círculos
                  </button>

                  <h3 className="truncate text-base font-extrabold text-slate-900">
                    Eliminar miembros · {selectedCircle.name}
                  </h3>

                  <p className="mt-1 text-xs text-slate-500">
                    Eliminar miembros no elimina el círculo ni sus reuniones.
                  </p>
                </div>

                <span className="w-fit shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-extrabold text-slate-600 shadow-sm ring-1 ring-slate-200">
                  {circleMembers.length} miembro(s)
                </span>
              </div>

              {loadingMembers ? (
                <div className="rounded-xl border border-slate-200 p-8 text-center text-xs text-slate-500">
                  Cargando miembros...
                </div>
              ) : circleMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <div className="text-2xl">👥</div>

                  <strong className="mt-2 block text-sm text-slate-700">
                    Este círculo no tiene miembros
                  </strong>

                  <p className="mt-1 text-xs text-slate-500">
                    El círculo continúa existiendo y puedes agregar miembros desde el Directorio.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={
                          selectedMemberIds.length ===
                          circleMembers.length
                        }
                        onChange={toggleAllMembers}
                        disabled={deletingMembers}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />

                      Seleccionar todos
                    </label>

                    <span className="text-[10px] font-semibold text-slate-400">
                      {selectedMemberIds.length} seleccionado(s)
                    </span>
                  </div>

                  <div className="max-h-[42vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                    <div className="divide-y divide-slate-200">
                      {circleMembers.map((member) => {
                        const memberId = member._id;
                        const checked =
                          selectedMemberIds.includes(memberId);

                        return (
                          <label
                            key={memberId}
                            className={`flex cursor-pointer items-center gap-3 px-3 py-3 transition sm:px-4 ${
                              checked
                                ? "bg-blue-50"
                                : "bg-white hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleMember(memberId)
                              }
                              disabled={deletingMembers}
                              className="h-4 w-4 shrink-0 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-extrabold text-slate-800">
                                {member.name || "Sin nombre"}
                              </div>

                              <div className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
                                DNI: {member.doc || "—"}
                                {member.job
                                  ? ` · ${member.job}`
                                  : ""}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* ÚNICO BOTÓN DE ELIMINACIÓN */}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={deleteSelectedMembers}
                      disabled={
                        !selectedMemberIds.length ||
                        deletingMembers
                      }
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-extrabold text-rose-600 shadow-sm transition hover:bg-rose-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingMembers
                        ? "Eliminando..."
                        : `🗑️ Eliminar seleccionados (${selectedMemberIds.length})`}
                    </button>
                  </div>

                  <p className="mt-3 text-center text-[10px] font-semibold leading-4 text-slate-400">
                    Esta acción elimina únicamente los miembros
                    seleccionados. El círculo y sus reuniones permanecerán
                    intactos.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CircleManager;