import {
  useEffect,
  useState,
} from "react";

import userService from "../services/userService";
import circleService from "../services/circleService";
import importService from "../services/importService";
import { useAuth } from "../context/AuthContext";
import ExcelImportModal from "../components/ExcelImportModal";

const EMPTY_FORM = {
  doc: "",
  name: "",
  username: "",
  circle: "",
  job: "",
  email: "",
  phone: "",
};

const RANK_OPTIONS = [
  "100K",
  "250K",
  "500K",
  "ELITE",
  "PRESIDENTIAL",
  "INFINITY",
];

const Members = () => {
  const { admin } = useAuth();

  const [users, setUsers] =
    useState([]);

  const [circles, setCircles] =
    useState([]);

  const [search, setSearch] =
    useState("");

  const [circle, setCircle] =
    useState("");

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const [fileInputKey, setFileInputKey] =
    useState(0);

  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [pendingExcelFile, setPendingExcelFile] = useState(null);

  /*
   * =========================================================
   * PERMISOS
   * =========================================================
   */

  const isMainAdmin =
    String(admin?.adminId || "").trim() ===
    "ADM-001";

  const isCircleManager =
    String(admin?.role || "").trim() ===
    "Gestor de Círculo";

  const canManageMembers =
    isMainAdmin ||
    isCircleManager;

  /*
   * =========================================================
   * CARGAR CÍRCULOS
   * =========================================================
   */

  const loadCircles =
    async () => {
      try {
        const data =
          await circleService.getCircles();

        const loadedCircles =
          Array.isArray(data)
            ? data
            : data.circles || [];

        setCircles(
          loadedCircles
        );
      } catch (err) {
        console.error(
          "Error cargando círculos:",
          err
        );
      }
    };

  /*
   * =========================================================
   * CARGAR MIEMBROS
   * =========================================================
   */

  const loadUsers =
    async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await userService.getUsers({
            search,
            circle,
            page,
            limit: 50,
          });

        setUsers(
          data.users || []
        );

        setPagination(
          data.pagination || {
            page,
            limit: 50,
            total: 0,
            totalPages: 1,
          }
        );
      } catch (err) {
        console.error(
          "Error cargando miembros:",
          err
        );

        setError(
          err?.message ||
            "No se pudieron cargar los miembros."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadCircles();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [page, circle]);

  /*
   * =========================================================
   * BÚSQUEDA
   * =========================================================
   */

  const handleSearch =
    (event) => {
      event.preventDefault();

      setPage(1);

      loadUsers();
    };

  const clearFilters =
    () => {
      setSearch("");
      setCircle("");
      setPage(1);
    };

  

  const openCreate =
    () => {
      setEditingUser(null);

      setForm({
        ...EMPTY_FORM,
      });

      setError("");
      setMessage("");
      setModalOpen(true);
    };

  const openEdit =
    (user) => {
      setEditingUser(user);

      setForm({
        doc:
          user.doc || "",

        name:
          user.name || "",

        username:
          user.username || "",

        circle:
          user.circle || "",

        job:
          user.job || "",

        email:
          user.email || "",

        phone:
          user.phone || "",
      });

      setError("");
      setMessage("");
      setModalOpen(true);
    };

  const closeModal =
    () => {
      if (saving) {
        return;
      }

      setModalOpen(false);
      setEditingUser(null);

      setForm({
        ...EMPTY_FORM,
      });
    };



  const updateForm =
    (field, value) => {
      setForm(
        (previous) => ({
          ...previous,
          [field]: value,
        })
      );
    };



  const handleSubmit =
    async (event) => {
      event.preventDefault();

      try {
        setSaving(true);
        setError("");
        setMessage("");

        if (
          !form.doc.trim() ||
          !form.name.trim() ||
          !form.circle.trim()
        ) {
          throw new Error(
            "DNI, nombre y círculo son obligatorios."
          );
        }

        if (editingUser) {
          await userService.updateUser(
            editingUser._id,
            form
          );

          setMessage(
            "Miembro actualizado correctamente."
          );
        } else {
          await userService.createUser(
            form
          );

          setMessage(
            "Miembro creado correctamente."
          );
        }

        closeModal();

        await loadUsers();
      } catch (err) {
        setError(
          err?.message ||
            "No se pudo guardar el miembro."
        );
      } finally {
        setSaving(false);
      }
    };

  const handleDelete =
    async (user) => {
      if (!isMainAdmin) {
        setError(
          "Solo el Administrador Principal puede eliminar miembros."
        );

        return;
      }

      const confirmed =
        window.confirm(
          `¿Deseas eliminar a ${user.name}?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setError("");
        setMessage("");

        await userService.deleteUser(
          user._id
        );

        setMessage(
          "Miembro eliminado correctamente."
        );

        await loadUsers();
      } catch (err) {
        setError(
          err?.message ||
            "No se pudo eliminar el miembro."
        );
      }
    };


  const handleDownload =
    async () => {
      try {
        setError("");

        await importService.downloadTemplate();
      } catch (err) {
        setError(
          err?.message ||
            "No se pudo descargar la plantilla."
        );
      }
    };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setMessage("");
    setPendingExcelFile(file);
    setExcelImportOpen(true);
    setFileInputKey((value) => value + 1);
  };


  if (!canManageMembers) {
    return (
      <section className="min-h-[calc(100vh-115px)] px-4 py-8">
        <div className="mx-auto max-w-[1085px]">
          <div className="rounded-xl border border-slate-700 bg-white p-8 text-center shadow-lg">
            <div className="mb-3 text-3xl">
              🔒
            </div>

            <h1 className="text-lg font-bold text-slate-900">
              Acceso restringido
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              No tienes permisos para administrar
              el Directorio de Miembros.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-[calc(100vh-115px)] px-3 py-5 sm:px-5 lg:px-6">

      <div className="mx-auto w-full max-w-[1085px]">

        {/* =====================================================
            MENSAJES
        ====================================================== */}

        {message && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm">
            {error}
          </div>
        )}

        {/* =====================================================
            BARRA SUPERIOR
        ====================================================== */}

        <form
          onSubmit={handleSearch}
          className="mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_4px_18px_rgba(15,23,42,0.10)] lg:flex-row lg:items-center"
        >

          {/* BUSCADOR */}

          <div className="min-w-0 flex-1">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Buscar por DNI, nombre, rango, círculo..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* FILTRO CÍRCULO */}

          <div className="lg:w-[205px] lg:shrink-0">
            <select
              value={circle}
              onChange={(event) => {
                setCircle(
                  event.target.value
                );

                setPage(1);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">
                {isMainAdmin
                  ? "Todos los círculos"
                  : "Todos mis círculos asignados"}
              </option>

              {circles.map(
                (item) => (
                  <option
                    key={
                      item._id ||
                      item.name
                    }
                    value={
                      item.name
                    }
                  >
                    {item.name}
                  </option>
                )
              )}
            </select>
          </div>

          {/* BUSCAR */}

          <button
            type="submit"
            className="h-10 rounded-lg border border-blue-700 bg-gradient-to-r from-blue-600 to-blue-800 px-4 text-xs font-bold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
          >
            🔎 Buscar
          </button>

          {/* LIMPIAR */}

          <button
            type="button"
            onClick={
              clearFilters
            }
            className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
          >
            Limpiar
          </button>

          {/* PLANTILLA */}

          <button
            type="button"
            onClick={
              handleDownload
            }
            className="h-10 rounded-lg border border-emerald-300 bg-white px-4 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50"
          >
            📥 Plantilla Excel
          </button>

          {/* SUBIR EXCEL */}

          <label className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-700">
            📤 Subir con Excel

            <input
              key={
                fileInputKey
              }
              type="file"
              accept=".xlsx,.xls"
              onChange={
                handleUpload
              }
              hidden
            />
          </label>

          {/* NUEVO MIEMBRO */}

          <button
            type="button"
            onClick={
              openCreate
            }
            className="h-10 rounded-lg border border-blue-800 bg-gradient-to-r from-blue-700 to-blue-900 px-4 text-xs font-bold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md"
          >
            + Nuevo Miembro
          </button>
        </form>

        {/* =====================================================
            TABLA
        ====================================================== */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_18px_rgba(15,23,42,0.10)]">

          {loading ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 px-5 text-center">
              <span className="text-3xl">
                ⏳
              </span>

              <strong className="text-sm font-bold text-slate-700">
                Cargando miembros...
              </strong>

              <small className="text-xs text-slate-400">
                Consultando MongoDB.
              </small>
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 px-5 text-center">
              <span className="text-3xl">
                👥
              </span>

              <strong className="text-sm font-bold text-slate-700">
                No hay miembros
              </strong>

              <small className="text-xs text-slate-400">
                No se encontraron registros
                con los filtros actuales.
              </small>
            </div>
          ) : (
            <div className="max-h-[570px] overflow-auto">
              <table className="w-full min-w-[920px] table-fixed">

                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200">

                    <th className="w-[95px] px-3.5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
                      DNI
                    </th>

                    <th className="w-[250px] px-3.5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Nombre completo
                    </th>

                    <th className="w-[115px] px-3.5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Usuario
                    </th>

                    <th className="w-[155px] px-3.5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Círculo asignado
                    </th>

                    <th className="w-[105px] px-3.5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Rango
                    </th>

                    <th className="w-[190px] px-3.5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Correo
                    </th>

                    <th className="w-[125px] px-3.5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Acciones
                    </th>

                  </tr>
                </thead>

                <tbody>

                  {users.map(
                    (user) => (
                      <tr
                        key={
                          user._id
                        }
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >

                        {/* DNI */}

                        <td className="px-3.5 py-3 align-middle text-xs font-bold text-emerald-700">
                          {user.doc}
                        </td>

                        {/* NOMBRE */}

                        <td className="overflow-hidden px-3.5 py-3 align-middle text-xs font-bold text-slate-800">
                          <span className="block truncate">
                            {user.name}
                          </span>
                        </td>

                        {/* USUARIO */}

                        <td className="overflow-hidden px-3.5 py-3 align-middle text-xs font-medium text-slate-600">
                          <span className="block truncate">
                            {user.username ||
                              "—"}
                          </span>
                        </td>

                        {/* CÍRCULO */}

                        <td className="px-3.5 py-3 align-middle">

                          <span className="inline-flex max-w-full items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-800">
                            <span className="truncate">
                              {user.circle}
                            </span>
                          </span>

                        </td>

                        {/* RANGO */}

                        <td className="overflow-hidden px-3.5 py-3 align-middle text-xs font-medium text-slate-600">
                          <span className="block truncate">
                            {user.job ||
                              "—"}
                          </span>
                        </td>

                        {/* CORREO */}

                        <td className="overflow-hidden px-3.5 py-3 align-middle">

                          <div className="flex min-w-0 flex-col gap-0.5">

                            <span className="truncate text-[11px] font-medium text-slate-500">
                              {user.email ||
                                "Sin correo"}
                            </span>

                            <small className="truncate text-[10px] text-slate-400">
                              {user.phone ||
                                "Sin teléfono"}
                            </small>

                          </div>

                        </td>

                        {/* ACCIONES */}

                        <td className="px-3.5 py-3 align-middle">

                          <div className="flex items-center gap-2">

                            {/* EDITAR:
                                ADMIN + GESTOR */}

                            {/* =====================================================
    EDITAR
    SOLO ADMINISTRADOR PRINCIPAL

    El Gestor NO puede editar miembros existentes.
    Solamente puede:
    - Crear nuevos miembros manualmente.
    - Subir nuevos miembros mediante Excel.
===================================================== */}

{isMainAdmin && (
  <button
    type="button"
    onClick={() =>
      openEdit(user)
    }
    title="Editar miembro"
    className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
  >
    ✏️
  </button>
)}

{/* =====================================================
    ELIMINAR
    SOLO ADMINISTRADOR PRINCIPAL
===================================================== */}

{isMainAdmin && (
  <button
    type="button"
    onClick={() =>
      handleDelete(user)
    }
    title="Eliminar miembro"
    className="inline-flex h-8 items-center justify-center rounded-md border border-rose-200 bg-white px-2 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
  >
    🗑️
  </button>
)}

                            {/* ELIMINAR:
                                SOLO ADMIN PRINCIPAL */}

                            {isMainAdmin && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    user
                                  )
                                }
                                title="Eliminar miembro"
                                className="inline-flex h-8 items-center justify-center rounded-md border border-rose-200 bg-white px-2 text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
                              >
                                🗑️
                              </button>
                            )}

                          </div>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>
            </div>
          )}

          {/* ===================================================
              PAGINACIÓN
          ==================================================== */}

          <div className="flex min-h-[54px] items-center justify-between border-t border-slate-200 bg-white px-3.5">

            <span className="text-[11px] font-medium text-slate-500">
              {pagination.total ||
                0}{" "}
              miembros
            </span>

            <div className="flex items-center gap-2">

              <button
                type="button"
                disabled={
                  page <= 1
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      value - 1
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-lg leading-none text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ‹
              </button>

              <strong className="min-w-[55px] text-center text-[11px] font-bold text-slate-700">
                {pagination.page ||
                  page}{" "}
                /{" "}
                {pagination.totalPages ||
                  1}
              </strong>

              <button
                type="button"
                disabled={
                  page >=
                  (pagination.totalPages ||
                    1)
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      value + 1
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-lg leading-none text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ›
              </button>

            </div>

          </div>

        </div>

      </div>

      {/* =======================================================
          GESTOR DE CÍRCULOS — SOLO ADMIN PRINCIPAL
      ======================================================== */}

      {excelImportOpen && pendingExcelFile && (
        <ExcelImportModal
          file={pendingExcelFile}
          circles={circles}
          onClose={() => {
            setExcelImportOpen(false);
            setPendingExcelFile(null);
          }}
          onCompleted={async (result) => {
            setMessage(`Importación completada: ${result.inserted || 0} miembros agregados. ${result.updated || 0} actualizados. ${result.skipped || 0} omitidos.`);
            setExcelImportOpen(false);
            setPendingExcelFile(null);
            setPage(1);
            await loadUsers();
          }}
        />
      )}

      {/* =======================================================
          MODAL
      ======================================================== */}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm"
          onMouseDown={
            closeModal
          }
        >

          <div
            className="max-h-[90vh] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >

            {/* HEADER MODAL */}

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div>
                <span className="text-[10px] font-extrabold tracking-wider text-slate-500">
                  MIEMBRO
                </span>

                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {editingUser
                    ? "Editar miembro"
                    : "Nuevo miembro"}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeModal
                }
                disabled={
                  saving
                }
                className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-2xl leading-none text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                ×
              </button>

            </div>

            {/* FORMULARIO */}

            <form
              onSubmit={
                handleSubmit
              }
              className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2"
            >

              {/* DNI */}

              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600">
                DNI

                <input
                  value={
                    form.doc
                  }
                  onChange={(event) =>
                    updateForm(
                      "doc",
                      event.target
                        .value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {/* NOMBRE */}

              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600">
                Nombre completo

                <input
                  value={
                    form.name
                  }
                  onChange={(event) =>
                    updateForm(
                      "name",
                      event.target
                        .value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {/* USUARIO */}

              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600">
                Usuario

                <input
                  value={
                    form.username
                  }
                  onChange={(event) =>
                    updateForm(
                      "username",
                      event.target
                        .value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {/* CÍRCULO */}

              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600">
                Círculo

                <select
                  value={
                    form.circle
                  }
                  onChange={(event) =>
                    updateForm(
                      "circle",
                      event.target
                        .value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">
                    Seleccionar círculo
                  </option>

                  {circles.map(
                    (item) => (
                      <option
                        key={
                          item._id ||
                          item.name
                        }
                        value={
                          item.name
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              {/* RANGO */}

<label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600">
  Rango

  <select
    value={form.job}
    onChange={(event) =>
      updateForm(
        "job",
        event.target.value
      )
    }
    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
  >
    <option value="">
      Seleccionar rango
    </option>

    {RANK_OPTIONS.map(
      (rank) => (
        <option
          key={rank}
          value={rank}
        >
          {rank}
        </option>
      )
    )}
  </select>
</label>

              {/* CORREO */}

              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600">
                Correo

                <input
                  type="email"
                  value={
                    form.email
                  }
                  onChange={(event) =>
                    updateForm(
                      "email",
                      event.target
                        .value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {/* TELÉFONO */}

              <label className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-600">
                Teléfono

                <input
                  value={
                    form.phone
                  }
                  onChange={(event) =>
                    updateForm(
                      "phone",
                      event.target
                        .value
                    )
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              {/* BOTONES */}

              <div className="col-span-1 flex justify-end gap-2 border-t border-slate-200 pt-4 sm:col-span-2">

                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                  className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="h-10 rounded-lg border border-blue-700 bg-gradient-to-r from-blue-600 to-blue-800 px-4 text-xs font-bold text-white shadow-sm transition hover:-translate-y-px hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Guardando..."
                    : editingUser
                    ? "Guardar cambios"
                    : "Crear miembro"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </section>
  );
};

export default Members;