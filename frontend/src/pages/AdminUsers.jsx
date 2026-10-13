import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Building2,
  Check,
  Crown,
  LoaderCircle,
  Mail,
  Pencil,
  Phone,
  Power,
  PowerOff,
  ShieldCheck,
  ShieldUser,
  UserCog,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import adminService from "../services/adminService";
import { useAuth } from "../context/AuthContext";
import circleService from "../services/circleService";

const EMPTY_FORM = {
  phone: "",
  name: "",
  email: "",
  password: "",
  role: "Gestor de Círculo",
  circleScope: [],
};

const ROLES = [
  "Administrador General",
  "Gestor de Círculo",
];

const getInitials = (name = "") =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AD";

const AdminUsers = () => {
  const [admins, setAdmins] =
    useState([]);

  const [circles, setCircles] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [modalOpen, setModalOpen] =
    useState(false);

  const [editingAdmin, setEditingAdmin] =
    useState(null);

  const [form, setForm] =
    useState(EMPTY_FORM);

  const { admin: currentAdmin } = useAuth();

  const isMainAdmin =
    String(currentAdmin?.role || "").trim() === "Administrador General" ||
    String(currentAdmin?.adminId || "").trim() === "ADM-001";

  const summary = useMemo(() => {
    const total = admins.length;
    const active = admins.filter(
      (admin) => admin.active
    ).length;
    const general = admins.filter(
      (admin) => admin.role === "Administrador General"
    ).length;
    const managers = admins.filter(
      (admin) => admin.role === "Gestor de Círculo"
    ).length;

    return {
      total,
      active,
      general,
      managers,
    };
  }, [admins]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        adminsResponse,
        circlesResponse,
      ] = await Promise.all([
        adminService.getAdmins(),
        circleService.getCircles(),
      ]);

      setAdmins(
        Array.isArray(adminsResponse)
          ? adminsResponse
          : adminsResponse?.admins || []
      );

      setCircles(
        Array.isArray(circlesResponse)
          ? circlesResponse
          : circlesResponse?.circles || []
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "No se pudieron cargar los administradores."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreate = () => {
    setEditingAdmin(null);
    setForm({
      ...EMPTY_FORM,
    });
    setError("");
    setMessage("");
    setModalOpen(true);
  };

  const openEdit = (admin) => {
    setEditingAdmin(admin);

    setForm({
      phone: admin.phone || "",
      name: admin.name || "",
      email: admin.email || "",
      password: "",
      role:
        admin.role ||
        "Gestor de Círculo",
      circleScope:
        Array.isArray(admin.circleScope)
          ? admin.circleScope
          : [],
    });

    setError("");
    setMessage("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalOpen(false);
    setEditingAdmin(null);
    setForm({
      ...EMPTY_FORM,
    });
  };

  const updateField = (
    field,
    value
  ) => {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  const changeRole = (role) => {
    setForm(
      (current) => ({
        ...current,
        role,
        circleScope:
          role ===
          "Administrador General"
            ? [
                "Todos los Círculos",
              ]
            : current.circleScope.filter(
                (circle) =>
                  circle !==
                  "Todos los Círculos"
              ),
      })
    );
  };

  const toggleCircle = (
    circleName
  ) => {
    setForm(
      (current) => {
        const exists =
          current.circleScope.includes(
            circleName
          );

        return {
          ...current,
          circleScope: exists
            ? current.circleScope.filter(
                (circle) =>
                  circle !==
                  circleName
              )
            : [
                ...current.circleScope,
                circleName,
              ],
        };
      }
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
          !form.name.trim() ||
          !form.email.trim() ||
          !form.role
        ) {
          throw new Error(
            "Nombre, correo y rol son obligatorios."
          );
        }

        if (form.role === "Gestor de Círculo") {
          const normalizedPhone = form.phone.replace(/\D/g, "");

          if (!/^\d{10,15}$/.test(normalizedPhone)) {
            throw new Error(
              "El número de WhatsApp debe incluir el prefijo internacional, sin el signo +."
            );
          }
        }

        if (
          !editingAdmin &&
          !form.password.trim()
        ) {
          throw new Error(
            "La contraseña es obligatoria."
          );
        }

        const normalizedPhone = form.phone.replace(/\D/g, "");

        const data = {
          phone: normalizedPhone,
          name: form.name.trim(),
          email: form.email
            .trim()
            .toLowerCase(),
          role: form.role,
          circleScope:
            form.role ===
            "Administrador General"
              ? [
                  "Todos los Círculos",
                ]
              : form.circleScope,
        };

        if (
          form.password.trim()
        ) {
          data.password =
            form.password;
        }

        if (editingAdmin) {
          await adminService.updateAdmin(
            editingAdmin._id,
            data
          );

          setMessage(
            "Administrador actualizado correctamente."
          );
        } else {
          await adminService.createAdmin(
            data
          );

          setMessage(
            "Administrador creado correctamente."
          );
        }

        closeModal();
        await loadData();
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo guardar el administrador."
        );
      } finally {
        setSaving(false);
      }
    };

  const toggleActive =
    async (admin) => {
      try {
        setError("");
        setMessage("");

        await adminService.updateAdmin(
          admin._id,
          {
            active:
              !admin.active,
          }
        );

        setMessage(
          admin.active
            ? "Administrador desactivado."
            : "Administrador activado."
        );

        await loadData();
      } catch (err) {
        setError(
          err?.message ||
            "No se pudo cambiar el estado."
        );
      }
    };

  if (!isMainAdmin) {
    return (
      <section className="module-page">
        <div className="module-error">
          No tienes permisos para gestionar usuarios administrativos.
        </div>
      </section>
    );
  }

  return (
    <section className="module-page admin-users-page">
      <div className="admin-users-hero">
        <div className="admin-users-hero-main">
          <div className="admin-users-hero-icon">
            <ShieldUser
              size={24}
              strokeWidth={1.9}
            />
          </div>

          <div className="admin-users-hero-copy">
            <span className="admin-users-eyebrow">
              Gestión de accesos
            </span>

            <h1>
              Administradores
            </h1>

            <p>
              Gestiona usuarios, permisos y alcance por círculo desde un solo lugar.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="admin-users-create-button"
          onClick={openCreate}
        >
          <span className="admin-users-create-icon">
            <UserPlus
              size={17}
              strokeWidth={2.1}
            />
          </span>
          <span>
            Nuevo administrador
          </span>
        </button>
      </div>

      <div className="admin-users-summary-grid">
        <div className="admin-summary-card admin-summary-card-blue">
          <div className="admin-summary-icon">
            <Users size={18} strokeWidth={1.9} />
          </div>
          <div className="admin-summary-copy">
            <span>Total</span>
            <strong>{summary.total}</strong>
          </div>
        </div>

        <div className="admin-summary-card admin-summary-card-green">
          <div className="admin-summary-icon">
            <ShieldCheck size={18} strokeWidth={1.9} />
          </div>
          <div className="admin-summary-copy">
            <span>Activos</span>
            <strong>{summary.active}</strong>
          </div>
        </div>

        <div className="admin-summary-card admin-summary-card-violet">
          <div className="admin-summary-icon">
            <Crown size={18} strokeWidth={1.9} />
          </div>
          <div className="admin-summary-copy">
            <span>Generales</span>
            <strong>{summary.general}</strong>
          </div>
        </div>

        <div className="admin-summary-card admin-summary-card-cyan">
          <div className="admin-summary-icon">
            <UserCog size={18} strokeWidth={1.9} />
          </div>
          <div className="admin-summary-copy">
            <span>Gestores</span>
            <strong>{summary.managers}</strong>
          </div>
        </div>
      </div>

      {error && (
        <div className="module-error">
          {error}
        </div>
      )}

      {message && (
        <div className="module-success">
          {message}
        </div>
      )}

      {loading ? (
        <div className="admin-users-loading-card">
          <LoaderCircle
            className="admin-users-spinner"
            size={24}
            strokeWidth={2}
          />
          <strong>
            Cargando administradores...
          </strong>
          <span>
            Estamos preparando la información del equipo.
          </span>
        </div>
      ) : (
        <div className="admin-users-table-card">
          <div className="admin-users-table-headline">
            <div>
              <span className="admin-users-table-kicker">
                Directorio administrativo
              </span>
              <h2>
                Equipo con acceso al sistema
              </h2>
            </div>

            <span className="admin-users-count-pill">
              {admins.length} usuario{admins.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-management-table admin-users-table">
              <thead>
                <tr>
                  <th>Administrador</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Círculos</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {admins.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="audit-empty-cell"
                    >
                      No hay usuarios administrativos.
                    </td>
                  </tr>
                ) : (
                  admins.map(
                    (admin) => {
                      const scope = Array.isArray(admin.circleScope)
                        ? admin.circleScope
                        : [];

                      const visibleScopes = scope.slice(0, 2);
                      const remainingScopes = Math.max(
                        0,
                        scope.length - visibleScopes.length
                      );

                      return (
                        <tr
                          key={admin._id}
                        >
                          <td>
                            <div className="admin-user-identity">
                              <div className="admin-user-avatar">
                                {getInitials(admin.name)}
                              </div>

                              <div className="admin-user-name-wrap">
                                <strong>
                                  {admin.name}
                                </strong>

                                <span>
                                  {admin.adminId || "Usuario administrativo"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="admin-user-email">
                              <Mail
                                size={14}
                                strokeWidth={1.9}
                              />
                              <span>
                                {admin.email}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={
                                admin.role === "Administrador General"
                                  ? "admin-role-badge admin-role-badge-general"
                                  : "admin-role-badge admin-role-badge-manager"
                              }
                            >
                              {admin.role === "Administrador General" ? (
                                <Crown size={13} strokeWidth={2} />
                              ) : (
                                <UserCog size={13} strokeWidth={2} />
                              )}
                              {admin.role}
                            </span>
                          </td>

                          <td>
                            <div className="admin-scope-list">
                              {visibleScopes.length === 0 ? (
                                <span className="admin-scope-empty">
                                  Sin asignar
                                </span>
                              ) : (
                                <>
                                  {visibleScopes.map((circle) => (
                                    <span
                                      key={circle}
                                      className="admin-scope-chip"
                                    >
                                      <Building2
                                        size={11}
                                        strokeWidth={2}
                                      />
                                      {circle}
                                    </span>
                                  ))}

                                  {remainingScopes > 0 && (
                                    <span className="admin-scope-more">
                                      +{remainingScopes}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            <span
                              className={
                                admin.active
                                  ? "status-badge active admin-status-badge"
                                  : "status-badge inactive admin-status-badge"
                              }
                            >
                              <span className="admin-status-dot" />
                              {admin.active
                                ? "Activo"
                                : "Inactivo"}
                            </span>
                          </td>

                          <td>
                            <div className="admin-row-actions admin-row-actions-modern">
                              <button
                                type="button"
                                className="admin-action-button admin-action-edit"
                                onClick={() =>
                                  openEdit(admin)
                                }
                                title="Editar administrador"
                                aria-label={`Editar a ${admin.name}`}
                              >
                                <Pencil
                                  size={15}
                                  strokeWidth={2}
                                />
                                <span>Editar</span>
                              </button>

                              {admin.adminId !== "ADM-001" && (
                                <button
                                  type="button"
                                  className={
                                    admin.active
                                      ? "admin-action-button admin-action-disable"
                                      : "admin-action-button admin-action-enable"
                                  }
                                  onClick={() =>
                                    toggleActive(admin)
                                  }
                                  title={
                                    admin.active
                                      ? "Desactivar administrador"
                                      : "Activar administrador"
                                  }
                                  aria-label={
                                    admin.active
                                      ? `Desactivar a ${admin.name}`
                                      : `Activar a ${admin.name}`
                                  }
                                >
                                  {admin.active ? (
                                    <PowerOff
                                      size={15}
                                      strokeWidth={2}
                                    />
                                  ) : (
                                    <Power
                                      size={15}
                                      strokeWidth={2}
                                    />
                                  )}
                                  <span>
                                    {admin.active
                                      ? "Desactivar"
                                      : "Activar"}
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop admin-modal-backdrop">
          <div className="modal-card admin-user-modal admin-user-modal-modern">
            <div className="admin-user-modal-header">
              <div className="admin-user-modal-header-main">
                <div className="admin-user-modal-icon">
                  {editingAdmin ? (
                    <Pencil size={18} strokeWidth={2} />
                  ) : (
                    <UserPlus size={18} strokeWidth={2} />
                  )}
                </div>

                <div>
                  <span className="admin-user-modal-kicker">
                    {editingAdmin
                      ? "Actualizar acceso"
                      : "Nuevo acceso"}
                  </span>
                  <h2>
                    {editingAdmin
                      ? "Editar administrador"
                      : "Nuevo administrador"}
                  </h2>
                  <p>
                    Define los datos, rol y alcance del usuario dentro del sistema.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="admin-user-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Cerrar"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <form
              className="admin-user-form admin-user-form-modern"
              onSubmit={handleSubmit}
            >
              <div className="admin-form-section">
                <div className="admin-form-section-heading">
                  <div>
                    <span>Información principal</span>
                    <p>
                      Datos de identificación y acceso del administrador.
                    </p>
                  </div>
                </div>

                <div className="form-grid admin-user-form-grid">
                  <label>
                    <span className="admin-field-label">
                      <Phone size={13} strokeWidth={2} />
                      Teléfono / WhatsApp
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={form.phone}
                      onChange={(event) =>
                        updateField(
                          "phone",
                          event.target.value.replace(/[^0-9\s()-]/g, "")
                        )
                      }
                      placeholder="Prefijo internacional + número"
                      maxLength={15}
                      disabled={saving}
                    />
                  </label>

                  <label>
                    <span className="admin-field-label">
                      <ShieldUser size={13} strokeWidth={2} />
                      Nombre
                    </span>
                    <input
                      value={form.name}
                      onChange={(event) =>
                        updateField(
                          "name",
                          event.target.value
                        )
                      }
                      placeholder="Nombre completo"
                      disabled={saving}
                    />
                  </label>

                  <label>
                    <span className="admin-field-label">
                      <Mail size={13} strokeWidth={2} />
                      Correo
                    </span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField(
                          "email",
                          event.target.value
                        )
                      }
                      placeholder="correo@empresa.com"
                      disabled={saving}
                    />
                  </label>

                  <label>
                    <span className="admin-field-label">
                      <ShieldCheck size={13} strokeWidth={2} />
                      Contraseña
                    </span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) =>
                        updateField(
                          "password",
                          event.target.value
                        )
                      }
                      placeholder={
                        editingAdmin
                          ? "Dejar vacío para conservar"
                          : "Contraseña"
                      }
                      disabled={saving}
                    />
                  </label>

                  <label className="admin-role-field">
                    <span className="admin-field-label">
                      <UserCog size={13} strokeWidth={2} />
                      Rol
                    </span>
                    <select
                      value={form.role}
                      onChange={(event) =>
                        changeRole(
                          event.target.value
                        )
                      }
                      disabled={saving}
                    >
                      {ROLES.map(
                        (role) => (
                          <option
                            key={role}
                            value={role}
                          >
                            {role}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                </div>
              </div>

              {form.role !== "Administrador General" && (
                <div className="admin-circle-scope admin-circle-scope-modern">
                  <div className="admin-circle-scope-heading">
                    <div>
                      <h3>
                        Círculos permitidos
                      </h3>
                      <p>
                        Selecciona los círculos que podrá gestionar este usuario.
                      </p>
                    </div>

                    <span className="admin-circle-selected-count">
                      {form.circleScope.length} seleccionado{form.circleScope.length === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="admin-circle-options admin-circle-options-modern">
                    {circles.map(
                      (circle) => {
                        const checked = form.circleScope.includes(
                          circle.name
                        );

                        return (
                          <label
                            key={
                              circle._id ||
                              circle.name
                            }
                            className={
                              checked
                                ? "admin-circle-option admin-circle-option-selected"
                                : "admin-circle-option"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleCircle(
                                  circle.name
                                )
                              }
                            />

                            <span className="admin-circle-check">
                              {checked && (
                                <Check
                                  size={12}
                                  strokeWidth={2.6}
                                />
                              )}
                            </span>

                            <span>
                              {circle.name}
                            </span>
                          </label>
                        );
                      }
                    )}
                  </div>
                </div>
              )}

              <div className="modal-actions admin-user-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button admin-user-save-button"
                  disabled={saving}
                >
                  {saving && (
                    <LoaderCircle
                      className="admin-users-spinner"
                      size={15}
                      strokeWidth={2.2}
                    />
                  )}
                  {saving
                    ? "Guardando..."
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminUsers;