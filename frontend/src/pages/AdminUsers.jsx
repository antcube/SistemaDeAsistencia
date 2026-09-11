import {
  useEffect,
  useState,
} from "react";

import adminService from "../services/adminService";
import { useAuth } from "../context/AuthContext";
import circleService from "../services/circleService";

const EMPTY_FORM = {
  adminId: "",
  doc: "",
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
    String(currentAdmin?.adminId || "").trim() === "ADM-001";

  const loadData =
    async () => {
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
          Array.isArray(
            adminsResponse
          )
            ? adminsResponse
            : adminsResponse?.admins ||
              []
        );

        setCircles(
          Array.isArray(
            circlesResponse
          )
            ? circlesResponse
            : circlesResponse?.circles ||
              []
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
      adminId:
        admin.adminId || "",
      doc:
        admin.doc || "",
      name:
        admin.name || "",
      email:
        admin.email || "",
      password: "",
      role:
        admin.role ||
        "Gestor de Círculo",
      circleScope:
        Array.isArray(
          admin.circleScope
        )
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
          !form.adminId.trim() ||
          !form.name.trim() ||
          !form.email.trim() ||
          !form.role
        ) {
          throw new Error(
            "ID, nombre, correo y rol son obligatorios."
          );
        }

        if (
          !editingAdmin &&
          !form.password.trim()
        ) {
          throw new Error(
            "La contraseña es obligatoria."
          );
        }

        const data = {
          adminId:
            form.adminId.trim(),
          doc:
            form.doc.trim(),
          name:
            form.name.trim(),
          email:
            form.email
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
    <section className="module-page">
      <div className="module-header">
        <div>
          <span className="cc-section-kicker">
            ADMINISTRACIÓN
          </span>

          <h1>
            Usuarios Admin
          </h1>

          <p>
            Gestiona los usuarios
            administrativos y sus
            permisos.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={openCreate}
        >
          + Nuevo administrador
        </button>
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
        <div className="table-empty">
          <span>⏳</span>

          <strong>
            Cargando administradores...
          </strong>
        </div>
      ) : (
        <div className="admin-management-card">
          <div className="admin-table-wrapper">
            <table className="admin-management-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
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
                      colSpan="7"
                      className="audit-empty-cell"
                    >
                      No hay usuarios
                      administrativos.
                    </td>
                  </tr>
                ) : (
                  admins.map(
                    (admin) => (
                      <tr
                        key={
                          admin._id
                        }
                      >
                        <td>
                          {
                            admin.adminId
                          }
                        </td>

                        <td>
                          <strong>
                            {
                              admin.name
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            admin.email
                          }
                        </td>

                        <td>
                          {
                            admin.role
                          }
                        </td>

                        <td>
                          {admin.circleScope?.join(
                            ", "
                          ) || "—"}
                        </td>

                        <td>
                          <span
                            className={
                              admin.active
                                ? "status-badge active"
                                : "status-badge inactive"
                            }
                          >
                            {admin.active
                              ? "Activo"
                              : "Inactivo"}
                          </span>
                        </td>

                        <td>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                openEdit(
                                  admin
                                )
                              }
                            >
                              Editar
                            </button>

                            {admin.adminId !==
                              "ADM-001" && (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                  toggleActive(
                                    admin
                                  )
                                }
                              >
                                {admin.active
                                  ? "Desactivar"
                                  : "Activar"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card admin-user-modal">
            <div className="modal-header">
              <div>
                <h2>
                  {editingAdmin
                    ? "Editar administrador"
                    : "Nuevo administrador"}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeModal
                }
              >
                ×
              </button>
            </div>

            <form
              className="admin-user-form"
              onSubmit={
                handleSubmit
              }
            >
              <div className="form-grid">
                <label>
                  ID administrativo
                  <input
                    value={
                      form.adminId
                    }
                    onChange={(event) =>
                      updateField(
                        "adminId",
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  />
                </label>

                <label>
                  DNI
                  <input
                    value={
                      form.doc
                    }
                    onChange={(event) =>
                      updateField(
                        "doc",
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  />
                </label>

                <label>
                  Nombre
                  <input
                    value={
                      form.name
                    }
                    onChange={(event) =>
                      updateField(
                        "name",
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  />
                </label>

                <label>
                  Correo
                  <input
                    type="email"
                    value={
                      form.email
                    }
                    onChange={(event) =>
                      updateField(
                        "email",
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
                  />
                </label>

                <label>
                  Contraseña
                  <input
                    type="password"
                    value={
                      form.password
                    }
                    onChange={(event) =>
                      updateField(
                        "password",
                        event.target
                          .value
                      )
                    }
                    placeholder={
                      editingAdmin
                        ? "Dejar vacío para conservar"
                        : "Contraseña"
                    }
                    disabled={
                      saving
                    }
                  />
                </label>

                <label>
                  Rol
                  <select
                    value={
                      form.role
                    }
                    onChange={(event) =>
                      changeRole(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      saving
                    }
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

              {form.role !==
                "Administrador General" && (
                <div className="admin-circle-scope">
                  <h3>
                    Círculos permitidos
                  </h3>

                  <div className="admin-circle-options">
                    {circles.map(
                      (circle) => (
                        <label
                          key={
                            circle._id ||
                            circle.name
                          }
                          className="admin-circle-option"
                        >
                          <input
                            type="checkbox"
                            checked={form.circleScope.includes(
                              circle.name
                            )}
                            onChange={() =>
                              toggleCircle(
                                circle.name
                              )
                            }
                          />

                          <span>
                            {
                              circle.name
                            }
                          </span>
                        </label>
                      )
                    )}
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    saving
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    saving
                  }
                >
                  {saving
                    ? "Guardando..."
                    : "Guardar"}
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