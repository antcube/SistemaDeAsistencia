import {
  useEffect,
  useState,
} from "react";

import auditService from "../services/auditService";

const Audit = () => {
  const [logs, setLogs] =
    useState([]);

  const [page, setPage] =
    useState(1);

  const [pagination, setPagination] =
    useState({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    });

  const [search, setSearch] =
    useState("");

  const [module, setModule] =
    useState("");

  const [action, setAction] =
    useState("");

  const [circle, setCircle] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadLogs =
    async (
      requestedPage = page
    ) => {
      try {
        setLoading(true);
        setError("");

        const response =
          await auditService.getLogs({
            page: requestedPage,
            limit: 50,
            search,
            module,
            action,
            circle,
          });

        setLogs(
          response?.data || []
        );

        setPagination(
          response?.pagination || {
            page: requestedPage,
            limit: 50,
            total: 0,
            totalPages: 1,
          }
        );
      } catch (err) {
        console.error(err);

        setError(
          err?.message ||
            "No se pudo cargar la bitácora."
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    loadLogs(1);
  }, []);

  const handleSearch =
    (event) => {
      event.preventDefault();

      setPage(1);
      loadLogs(1);
    };

  const clearFilters =
    () => {
      setSearch("");
      setModule("");
      setAction("");
      setCircle("");
      setPage(1);

      setTimeout(() => {
        loadLogs(1);
      }, 0);
    };

  const previousPage =
    () => {
      if (page <= 1) {
        return;
      }

      const nextPage =
        page - 1;

      setPage(nextPage);
      loadLogs(nextPage);
    };

  const nextPage =
    () => {
      if (
        page >=
        pagination.totalPages
      ) {
        return;
      }

      const next =
        page + 1;

      setPage(next);
      loadLogs(next);
    };

  return (
    <section className="module-page">
      <div className="module-header">
        <div>
          <span className="cc-section-kicker">
            SEGURIDAD
          </span>

          <h1>
            Bitácora
          </h1>

          <p>
            Historial de acciones
            realizadas en el sistema.
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            loadLogs(page)
          }
          disabled={loading}
        >
          🔄 Actualizar
        </button>
      </div>

      {error && (
        <div className="module-error">
          {error}
        </div>
      )}

      <form
        className="audit-filters"
        onSubmit={
          handleSearch
        }
      >
        <input
          type="search"
          value={search}
          onChange={(event) =>
            setSearch(
              event.target.value
            )
          }
          placeholder="Buscar..."
        />

        <input
          value={module}
          onChange={(event) =>
            setModule(
              event.target.value
            )
          }
          placeholder="Módulo"
        />

        <input
          value={action}
          onChange={(event) =>
            setAction(
              event.target.value
            )
          }
          placeholder="Acción"
        />

        <input
          value={circle}
          onChange={(event) =>
            setCircle(
              event.target.value
            )
          }
          placeholder="Círculo"
        />

        <button
          type="submit"
          className="primary-button"
        >
          🔎 Buscar
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={
            clearFilters
          }
        >
          Limpiar
        </button>
      </form>

      {loading ? (
        <div className="table-empty">
          <span>⏳</span>

          <strong>
            Cargando bitácora...
          </strong>
        </div>
      ) : (
        <>
          <div className="admin-management-card">
            <div className="admin-table-wrapper">
              <table className="admin-management-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Administrador</th>
                    <th>Módulo</th>
                    <th>Acción</th>
                    <th>Descripción</th>
                    <th>Círculo</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="audit-empty-cell"
                      >
                        No hay registros.
                      </td>
                    </tr>
                  ) : (
                    logs.map(
                      (log) => (
                        <tr
                          key={
                            log._id
                          }
                        >
                          <td>
                            {log.createdAt
                              ? new Date(
                                  log.createdAt
                                ).toLocaleString(
                                  "es-PE"
                                )
                              : "—"}
                          </td>

                          <td>
                            <strong>
                              {
                                log.adminName
                              }
                            </strong>

                            <small>
                              {
                                log.adminId
                              }
                            </small>
                          </td>

                          <td>
                            {
                              log.module
                            }
                          </td>

                          <td>
                            {
                              log.action
                            }
                          </td>

                          <td>
                            {
                              log.description ||
                                "—"
                            }
                          </td>

                          <td>
                            {
                              log.circle ||
                                "—"
                            }
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="audit-pagination">
            <button
              type="button"
              className="secondary-button"
              onClick={
                previousPage
              }
              disabled={
                page <= 1
              }
            >
              ← Anterior
            </button>

            <span>
              Página{" "}
              <strong>
                {page}
              </strong>{" "}
              de{" "}
              <strong>
                {
                  pagination.totalPages
                }
              </strong>
            </span>

            <button
              type="button"
              className="secondary-button"
              onClick={
                nextPage
              }
              disabled={
                page >=
                pagination.totalPages
              }
            >
              Siguiente →
            </button>
          </div>
        </>
      )}
    </section>
  );
};

export default Audit;