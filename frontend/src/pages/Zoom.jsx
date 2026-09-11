import {
  useEffect,
  useState,
} from "react";

import zoomService from "../services/zoomService";

import "../styles/zoom.css";

const Zoom = () => {
  const [
    sessionType,
    setSessionType,
  ] = useState("");

  const [
    file,
    setFile,
  ] = useState(null);

  const [
    processing,
    setProcessing,
  ] = useState(false);

  const [
    result,
    setResult,
  ] = useState(null);

  const [
    info,
    setInfo,
  ] = useState({
    members: 0,
    records: 0,
    emails: 0,
    detectedDate: "",
    circles: 0,
  });

  useEffect(() => {
    const loadInfo =
      async () => {
        try {
          const response =
            await zoomService.getInfo();

          setInfo(
            response?.data ||
              response ||
              {}
          );
        } catch (error) {
          console.error(
            "Error cargando información Zoom:",
            error
          );
        }
      };

    loadInfo();
  }, []);

  const handleFile = (
    event
  ) => {
    const selected =
      event.target.files?.[0];

    setFile(
      selected || null
    );

    setResult(null);

    if (!selected) {
      return;
    }

    setInfo(
      (current) => ({
        ...current,

        records: 0,

        emails: 0,

        detectedDate: "",
      })
    );
  };

  const handleProcess =
    async () => {
      if (
        !sessionType ||
        !file
      ) {
        return;
      }

      try {
        setProcessing(
          true
        );

        setResult(null);

        const formData =
          new FormData();

        formData.append(
          "sessionType",
          sessionType
        );

        formData.append(
          "file",
          file
        );

        const response =
          await zoomService.processReport(
            formData
          );

        setResult(
          response
        );

        setInfo(
          (current) => ({
            ...current,

            records:
              response?.records ??
              0,

            emails:
              response?.emails ??
              0,

            detectedDate:
              response?.detectedDate ||
              "",

            circles:
              response?.circles
                ?.length ??
              current.circles,
          })
        );
      } catch (error) {
        console.error(
          "Error procesando Zoom:",
          error
        );

        setResult({
          error:
            error?.message ||
            "No se pudo procesar el reporte de Zoom.",
        });
      } finally {
        setProcessing(
          false
        );
      }
    };

  const helpText =
    sessionType
      ? "La fecha se detecta automáticamente desde el reporte. Solo se procesarán los miembros de los círculos que tienes autorizados."
      : "Selecciona el tipo de sesión y carga el reporte de Zoom.";

  return (
    <section
      id="tab-zoom"
      className="zoom-page"
    >
      <div className="zoom-main-card">

        {/* ======================================================
            ENCABEZADO
        ====================================================== */}

        <div className="zoom-heading">
          <div>
            <h2>
              📊 Procesar Asistencia
              de Zoom
            </h2>

            <p>
              Selecciona el tipo de
              sesión y carga el reporte
              de Zoom. El sistema detectará
              automáticamente la fecha y
              trabajará únicamente con los
              círculos autorizados.
            </p>

            <p>
              Los miembros se toman del
              Directorio de Miembros según
              los círculos que tienes asignados.
              No se procesan miembros de otros
              círculos.
            </p>
          </div>

          <span className="zoom-validation">
            Validación automática
          </span>
        </div>

        {/* ======================================================
            CONTROLES
        ====================================================== */}

        <div className="zoom-grid">

          {/* TIPO */}

          <div className="zoom-card zoom-session-card">

            <label>
              Tipo de sesión{" "}
              <span>*</span>
            </label>

            <select
              value={
                sessionType
              }
              onChange={(
                event
              ) =>
                setSessionType(
                  event.target
                    .value
                )
              }
              disabled={
                processing
              }
            >
              <option value="">
                Seleccione...
              </option>

              <option value="CIRCULO DE LIDERAZGO">
                🔵 CÍRCULO DE LIDERAZGO
              </option>

              <option value="HEALTH">
                🟦 HEALTH
              </option>

              <option value="MENTORIA">
                🟣 MENTORÍA
              </option>

              <option value="MASTERCLASS">
                ⚫ MASTERCLASS
              </option>

              <option value="ANUNCIOS CORPORATIVOS">
                🌙 ANUNCIOS CORPORATIVOS
              </option>
            </select>

            <p>
              {helpText}
            </p>
          </div>

          {/* ARCHIVO */}

          <div className="zoom-card zoom-file-card">

            <h3>
              Reporte de Zoom
            </h3>

            <label
              htmlFor="zoomReportFile"
              className="zoom-file-label"
            >
              📁 Seleccionar reporte
            </label>

            <input
              id="zoomReportFile"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={
                handleFile
              }
              disabled={
                processing
              }
            />

            <p>
              {file
                ? file.name
                : "Ningún archivo seleccionado"}
            </p>
          </div>

          {/* PROCESAMIENTO */}

          <div className="zoom-card zoom-processing-card">

            <h3>
              Procesamiento automático
            </h3>

            <p>
              El sistema distribuye el
              reporte según el Directorio
              de Miembros.
            </p>

            <div className="zoom-process-grid">

              <div>
                <strong>
                  Fuente
                </strong>

                <span>
                  Directorio de Miembros
                </span>
              </div>

              <div>
                <strong>
                  Asignación
                </strong>

                <span>
                  Círculo actual del miembro
                </span>
              </div>

              <div>
                <strong>
                  Validación
                </strong>

                <span>
                  Correo + mínimo 10 minutos
                </span>
              </div>

            </div>
          </div>
        </div>

        {/* ======================================================
            INFORMACIÓN
        ====================================================== */}

        <div
          id="zoomDetectedInfo"
          className="zoom-info-grid"
        >

          <div>
            <small>
              Directorio de Miembros
            </small>

            <strong>
              {info.members ||
                0}
            </strong>
          </div>

          <div>
            <small>
              Registros Zoom
            </small>

            <strong>
              {info.records ||
                0}
            </strong>
          </div>

          <div>
            <small>
              Correos Zoom
            </small>

            <strong>
              {info.emails ||
                0}
            </strong>
          </div>

          <div>
            <small>
              Fecha detectada
            </small>

            <strong>
              {info.detectedDate ||
                "—"}
            </strong>
          </div>

          <div>
            <small>
              Círculos
            </small>

            <strong>
              {info.circles ||
                0}
            </strong>
          </div>
        </div>

        {/* ======================================================
            BOTÓN
        ====================================================== */}

        <div className="zoom-bottom">

          <p>
            Se marcará automáticamente
            <strong>
              {" "}
              Asistió
            </strong>{" "}
            si el miembro aparece con
            su correo y acumula al menos
            10 minutos. Los demás quedan
            como{" "}
            <strong>
              No asistió
            </strong>
            .
          </p>

          <button
            type="button"
            disabled={
              !sessionType ||
              !file ||
              processing
            }
            onClick={
              handleProcess
            }
          >
            ⚡{" "}
            {processing
              ? "Procesando..."
              : "Filtrar y Aplicar Asistencia"}
          </button>
        </div>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {result?.error && (
          <div className="zoom-error">
            {result.error}
          </div>
        )}

        {/* ======================================================
            RESULTADO
        ====================================================== */}

        {result &&
          !result.error && (
            <div className="zoom-results-panel">

              <div className="zoom-results-header">

                <div>
                  <h3>
                    Resultado del procesamiento
                  </h3>

                  <p>
                    {result.type ||
                      sessionType}{" "}
                    ·{" "}
                    {result.detectedDate ||
                      "—"}
                  </p>
                </div>

                <span>
                  ✓ Procesado
                </span>
              </div>

              <div className="zoom-result-summary">

                <div>
                  <small>
                    Asistencias
                  </small>

                  <strong>
                    {result.present ||
                      0}
                  </strong>
                </div>

                <div>
                  <small>
                    Faltas
                  </small>

                  <strong>
                    {result.absent ||
                      0}
                  </strong>
                </div>

                <div>
                  <small>
                    No encontrados
                  </small>

                  <strong>
                    {result.unmatched ||
                      0}
                  </strong>
                </div>

                <div>
                  <small>
                    Procesados
                  </small>

                  <strong>
                    {result.applied ??
                      result.processed ??
                      0}
                  </strong>
                </div>

              </div>

              <div className="zoom-results-table-wrapper">

                <table className="zoom-results-table">

                  <thead>
                    <tr>
                      <th>
                        DNI
                      </th>

                      <th>
                        Miembro
                      </th>

                      <th>
                        Correo
                      </th>

                      <th>
                        Círculo
                      </th>

                      <th>
                        Minutos
                      </th>

                      <th>
                        Estado
                      </th>
                    </tr>
                  </thead>

                  <tbody>

                    {Array.isArray(
                      result.results
                    ) &&
                      result.results.map(
                        (
                          item,
                          index
                        ) => (
                          <tr
                            key={
                              `${item.dni}-${item.meetingId}-${index}`
                            }
                          >
                            <td>
                              {item.dni ||
                                "—"}
                            </td>

                            <td>
                              {item.name ||
                                "—"}
                            </td>

                            <td>
                              {item.email ||
                                "—"}
                            </td>

                            <td>
                              {item.circle ||
                                "—"}
                            </td>

                            <td>
                              {item.totalMinutes ??
                                0}
                            </td>

                            <td>

                              {item.status ===
                              "ASISTIÓ" ? (
                                <span className="zoom-status-present">
                                  ✓ ASISTIÓ
                                </span>
                              ) : (
                                <span className="zoom-status-absent">
                                  FALTA
                                </span>
                              )}

                            </td>
                          </tr>
                        )
                      )}

                  </tbody>
                </table>
              </div>

            </div>
          )}
      </div>
    </section>
  );
};

export default Zoom;