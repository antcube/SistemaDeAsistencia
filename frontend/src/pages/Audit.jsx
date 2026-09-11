import {
  useEffect,
  useState,
} from "react";

import auditService from "../services/auditService";
import circleService from "../services/circleService";

const Audit = () => {
  const [logs, setLogs] = useState([]);

  const [circles, setCircles] = useState([]);

  const [circle, setCircle] = useState("");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  /*
   * =========================================================
   * CARGAR CÍRCULOS
   * =========================================================
   */

  const loadCircles = async () => {
    try {
      const response =
        await circleService.getCircles();

      const circleList =
        Array.isArray(response)
          ? response
          : response?.data ||
            response?.circles ||
            [];

      const normalizedCircles =
        circleList
          .map((item) => {
            if (
              typeof item === "string"
            ) {
              return item.trim();
            }

            return String(
              item?.name || ""
            ).trim();
          })
          .filter(Boolean);

      const uniqueCircles = [
        ...new Set(
          normalizedCircles
        ),
      ];

      uniqueCircles.sort(
        (a, b) =>
          a.localeCompare(
            b,
            "es",
            {
              numeric: true,
              sensitivity: "base",
            }
          )
      );

      setCircles(
        uniqueCircles
      );
    } catch (err) {
      console.error(
        "Error cargando círculos:",
        err
      );

      setCircles([]);
    }
  };

  /*
   * =========================================================
   * CARGAR BITÁCORA
   * =========================================================
   */

  const loadLogs = async ({
    requestedPage = 1,
    selectedCircle = "",
  } = {}) => {
    try {
      setLoading(true);
      setError("");

      const response =
        await auditService.getLogs({
          page: requestedPage,
          limit: 50,
          circle:
            selectedCircle,
        });

      /*
       * IMPORTANTE:
       * Siempre reemplazamos completamente
       * los registros anteriores.
       *
       * Si LIMA 2 devuelve [], se muestran []
       * y no los registros anteriores de LIMA 1.
       */

      setLogs(
        Array.isArray(
          response?.data
        )
          ? response.data
          : []
      );

      setPagination(
        response?.pagination || {
          page: requestedPage,
          limit: 50,
          total: 0,
          totalPages: 1,
        }
      );

      setPage(
        Number(
          response?.pagination?.page ||
            requestedPage
        )
      );
    } catch (err) {
      console.error(
        "Error cargando bitácora:",
        err
      );

      setLogs([]);

      setPagination({
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
      });

      setError(
        err?.message ||
          "No se pudo cargar la bitácora."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * =========================================================
   * INICIO
   * =========================================================
   */

  useEffect(() => {
    loadCircles();

    loadLogs({
      requestedPage: 1,
      selectedCircle: "",
    });
  }, []);

  /*
   * =========================================================
   * CAMBIO DE CÍRCULO
   *
   * Al cambiar el desplegable hacemos la consulta
   * inmediatamente.
   *
   * Así no dependemos de que React haya actualizado
   * todavía el estado antes de hacer la consulta.
   * =========================================================
   */

  const handleCircleChange = async (
    event
  ) => {
    const selectedCircle =
      event.target.value;

    setCircle(
      selectedCircle
    );

    setPage(1);

    await loadLogs({
      requestedPage: 1,
      selectedCircle:
        selectedCircle,
    });
  };

  /*
   * =========================================================
   * BOTÓN BUSCAR
   * =========================================================
   */

  const handleSearch = async (
    event
  ) => {
    event.preventDefault();

    setPage(1);

    await loadLogs({
      requestedPage: 1,
      selectedCircle:
        circle,
    });
  };

  /*
   * =========================================================
   * LIMPIAR
   * =========================================================
   */

  const clearFilters =
    async () => {
      setCircle("");
      setPage(1);

      await loadLogs({
        requestedPage: 1,
        selectedCircle: "",
      });
    };

  /*
   * =========================================================
   * PAGINACIÓN
   * =========================================================
   */

  const previousPage =
    async () => {
      if (page <= 1) {
        return;
      }

      const nextPage =
        page - 1;

      await loadLogs({
        requestedPage:
          nextPage,
        selectedCircle:
          circle,
      });
    };

  const nextPage =
    async () => {
      if (
        page >=
        pagination.totalPages
      ) {
        return;
      }

      const next =
        page + 1;

      await loadLogs({
        requestedPage: next,
        selectedCircle:
          circle,
      });
    };

  return (
    <section className="module-page">

      {/* =====================================================
          ENCABEZADO
      ===================================================== */}

      <div className="module-header">

        <div>

          <span className="cc-section-kicker">
            SEGURIDAD
          </span>

          <h1>
            Bitácora
          </h1>

          <p>
            Historial de cambios
            realizados en los círculos.
          </p>

        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            loadLogs({
              requestedPage:
                page,
              selectedCircle:
                circle,
            })
          }
          disabled={loading}
        >
          🔄 Actualizar
        </button>

      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="module-error">
          {error}
        </div>
      )}

      {/* =====================================================
          FILTRO POR CÍRCULO
      ===================================================== */}

      <form
        className="audit-filters audit-filters-circle-only"
        onSubmit={
          handleSearch
        }
      >

        <div className="audit-circle-field">

          <label htmlFor="audit-circle">
            Círculo
          </label>

          <select
            id="audit-circle"
            value={circle}
            onChange={
              handleCircleChange
            }
          >

            <option value="">
              Todos los círculos
            </option>

            {circles.map(
              (circleName) => (
                <option
                  key={circleName}
                  value={circleName}
                >
                  {circleName}
                </option>
              )
            )}

          </select>

        </div>

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

      {/* =====================================================
          TABLA
      ===================================================== */}

      {loading ? (

        <div className="table-empty">

          <span>
            ⏳
          </span>

          <strong>
            Cargando bitácora...
          </strong>

        </div>

      ) : (

        <>

          <div className="admin-management-card">

            <div className="admin-table-wrapper">

              <table className="admin-management-table audit-table">

                <thead>

                  <tr>

                    <th>
                      Fecha
                    </th>

                    <th>
                      Administrador
                    </th>

                    <th>
                      Descripción
                    </th>

                    <th>
                      Círculo
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {logs.length === 0 ? (

                    <tr>

                      <td
                        colSpan="4"
                        className="audit-empty-cell"
                      >
                        {circle
                          ? `No hay registros para ${circle}.`
                          : "No hay registros en la bitácora."
                        }
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
                                log.adminName ||
                                "—"
                              }
                            </strong>

                            {log.adminId && (
                              <small>
                                {
                                  log.adminId
                                }
                              </small>
                            )}

                          </td>

                          <td>
                            {
                              log.description ||
                              "—"
                            }
                          </td>

                          <td>

                            <span className="audit-circle-badge">
                              {
                                log.circle ||
                                "—"
                              }
                            </span>

                          </td>

                        </tr>

                      )
                    )

                  )}

                </tbody>

              </table>

            </div>

          </div>

          {/* =================================================
              PAGINACIÓN
          ================================================= */}

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