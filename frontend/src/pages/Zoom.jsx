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

      const [
        apiMeetingId,
        setApiMeetingId,
      ] = useState("");

      const [
        apiMeetings,
        setApiMeetings,
      ] = useState([]);

      const [
        apiDate,
        setApiDate,
      ] = useState("");

      const [
        apiProcessing,
        setApiProcessing,
      ] = useState(false);

      const [
        apiResult,
        setApiResult,
      ] = useState(null);

      const [
        apiLinkType,
        setApiLinkType,
      ] = useState("");

      const [
        apiLinkStartTime,
        setApiLinkStartTime,
      ] = useState("20:00");

      const [
        apiLinkEndTime,
        setApiLinkEndTime,
      ] = useState("21:00");


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

        const loadApiConfig =
          async () => {
            try {
              const response =
                await zoomService.getApiConfig();

              const config =
                response?.data ||
                response ||
                {};

              const meetings =
                Array.isArray(config.meetings)
                  ? config.meetings
                  : [];

              setApiMeetings(meetings);

              if (meetings.length > 0) {
                setApiMeetingId((current) => current || meetings[0].meetingId || "");
                setApiLinkType((current) => current || meetings[0].type || "");
              }
            } catch (error) {
              console.error(
                "Error cargando configuración Zoom API:",
                error
              );
            }
          };

        loadInfo();
        loadApiConfig();
      }, []);

      const selectedApiMeeting =
        apiMeetings.find(
          (item) => String(item.meetingId) === String(apiMeetingId)
        ) || null;

      const handleApiMeetingChange = (event) => {
        const meetingId = event.target.value;
        const selected = apiMeetings.find(
          (item) => String(item.meetingId) === String(meetingId)
        );

        setApiMeetingId(meetingId);
        setApiLinkType(selected?.type || "");
        setApiResult(null);
      };

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
          ? "La fecha se detecta automáticamente. Se buscará esa sesión en el Calendario y, si no existe, se creará para esa fecha."
          : "Selecciona el tipo de sesión y carga el reporte de Zoom.";

      const handleApiPreview =
        async () => {
          if (!apiMeetingId || !apiDate) {
            return;
          }

          try {
            setApiProcessing(true);
            setApiResult(null);

            const response =
              await zoomService.previewApi({
                meetingId: apiMeetingId,
                date: apiDate,
              });

            setApiResult(response);
            setApiLinkType(response?.sessionType || "");
          } catch (error) {
            setApiResult({
              error:
                error?.message ||
                "No se pudo consultar Zoom API.",
            });
          } finally {
            setApiProcessing(false);
          }
        };

      const handleApiSync =
        async () => {
          if (!apiMeetingId || !apiDate) {
            return;
          }

          try {
            setApiProcessing(true);

            const response =
              await zoomService.syncApi({
                meetingId: apiMeetingId,
                date: apiDate,
              });

            setApiResult(response);
          } catch (error) {
            setApiResult({
              error:
                error?.message ||
                "No se pudo sincronizar Zoom API.",
            });
          } finally {
            setApiProcessing(false);
          }
        };

      const handleApiLink =
        async () => {
          if (!apiMeetingId || !apiDate || !apiLinkType) {
            return;
          }

          try {
            setApiProcessing(true);

            await zoomService.linkApi({
              meetingId: apiMeetingId,
              date: apiDate,
              sessionType: apiLinkType,
              startTime: apiLinkStartTime,
              endTime: apiLinkEndTime,
            });

            const refreshed = await zoomService.previewApi({
              meetingId: apiMeetingId,
              date: apiDate,
            });

            setApiResult(refreshed);
            setApiLinkType(refreshed?.sessionType || apiLinkType);
          } catch (error) {
            setApiResult({
              error:
                error?.message ||
                "No se pudo crear y vincular la reunión.",
            });
          } finally {
            setApiProcessing(false);
          }
        };

      const handleApiFinalize =
        async () => {
          if (!apiMeetingId || !apiDate || apiResult?.linkRequired) {
            return;
          }

          const confirmed = window.confirm(
            "¿Finalizar esta sesión? Se volverán a sumar todas las instancias Zoom del día. Quienes no alcancen 10 minutos y no tengan Asistió, Clase Presencial o Justificado quedarán como No asistió."
          );

          if (!confirmed) {
            return;
          }

          try {
            setApiProcessing(true);

            const response =
              await zoomService.finalizeApi({
                meetingId: apiMeetingId,
                date: apiDate,
              });

            setApiResult(response);
          } catch (error) {
            setApiResult({
              error:
                error?.message ||
                "No se pudo finalizar la sesión Zoom.",
            });
          } finally {
            setApiProcessing(false);
          }
        };

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
                  completará la reunión correspondiente
                  del Calendario.
                </p>

                <p>
                  Puedes cargar varios reportes
                  del mismo día. Cada reporte solo
                  agrega las asistencias que cumplen
                  el filtro y no modifica a quienes
                  no aparecen.
                </p>
              </div>

              <span className="zoom-validation">
                Validación automática
              </span>
            </div>

            <div className="zoom-api-panel">
              <div className="zoom-api-heading">
                <div>
                  <h3>🔌 Zoom API</h3>
                  <p>
                    La API puede trabajar manualmente desde aquí y también de forma automática: 10 minutos después de la hora final del Calendario y una segunda revisión a las 23:30. Suma todas las instancias del mismo Meeting ID y solo aplica asistencia cuando el correo coincide y llega a 10 minutos.
                  </p>
                </div>
                <span>Sin faltas automáticas</span>
              </div>

              <div className="zoom-api-controls">
                <label>
                  Meeting ID
                  <select
                    value={apiMeetingId}
                    onChange={handleApiMeetingChange}
                    disabled={apiProcessing || apiMeetings.length === 0}
                  >
                    {apiMeetings.length === 0 && (
                      <option value="">No hay Meeting IDs configurados</option>
                    )}
                    {apiMeetings.map((item) => (
                      <option key={`${item.type}-${item.meetingId}`} value={item.meetingId}>
                        {item.meetingId}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Pertenece a
                  <input
                    value={selectedApiMeeting?.type || apiLinkType || ""}
                    readOnly
                    placeholder="Selecciona un Meeting ID"
                    className="zoom-api-readonly"
                  />
                </label>

                <label>
                  Fecha de la sesión
                  <input
                    type="date"
                    value={apiDate}
                    onChange={(event) =>
                      setApiDate(event.target.value)
                    }
                    disabled={apiProcessing}
                  />
                </label>

                <label>
                  Hora de inicio
                  <input
                    type="time"
                    value={apiLinkStartTime}
                    onChange={(event) => setApiLinkStartTime(event.target.value)}
                    disabled={apiProcessing}
                  />
                </label>

                <label>
                  Hora de fin
                  <input
                    type="time"
                    value={apiLinkEndTime}
                    onChange={(event) => setApiLinkEndTime(event.target.value)}
                    disabled={apiProcessing}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleApiPreview}
                  disabled={!apiMeetingId || !apiDate || apiProcessing}
                >
                  {apiProcessing ? "Consultando..." : "Probar sin aplicar"}
                </button>

                <button
                  type="button"
                  className="zoom-api-sync-button"
                  onClick={handleApiSync}
                  disabled={!apiMeetingId || !apiDate || apiProcessing || apiResult?.linkRequired}
                >
                  Sincronizar asistencias
                </button>

                <button
                  type="button"
                  className="zoom-api-finalize-button"
                  onClick={handleApiFinalize}
                  disabled={!apiMeetingId || !apiDate || apiProcessing || apiResult?.linkRequired}
                >
                  Finalizar sesión
                </button>
              </div>

              {apiResult?.error && (
                <div className="zoom-error">{apiResult.error}</div>
              )}

              {apiResult && !apiResult.error && apiResult.linkRequired && (
                <div className="zoom-link-warning">
                  <div>
                    <strong>⚠ Falta vinculación con el Calendario</strong>
                    <p>
                      Zoom detectó {apiResult.sessionType || "esta sesión"} del {apiResult.date || apiDate},
                      pero faltan reuniones de Calendario para {apiResult.missingCircles?.length || 0} círculo(s).
                      No se aplicará ninguna asistencia ni falta hasta vincularla.
                    </p>
                    {Array.isArray(apiResult.missingCircles) && apiResult.missingCircles.length > 0 && (
                      <small>Faltan: {apiResult.missingCircles.join(", ")}</small>
                    )}
                  </div>

                  <div className="zoom-link-actions">
                    <label>
                      Tipo de reunión
                      <input
                        value={apiLinkType || selectedApiMeeting?.type || ""}
                        readOnly
                        className="zoom-api-readonly"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleApiLink}
                      disabled={
                        !apiLinkType ||
                        !apiLinkStartTime ||
                        !apiLinkEndTime ||
                        apiProcessing
                      }
                    >
                      Crear y vincular
                    </button>
                  </div>
                </div>
              )}

              {apiResult && !apiResult.error && (
                <div className="zoom-api-result">
                  <div className="zoom-api-summary">
                    <div><small>Categoría</small><strong>{apiResult.sessionType || "—"}</strong></div>
                    <div><small>Instancias</small><strong>{apiResult.instances ?? 0}</strong></div>
                    <div><small>Correos</small><strong>{apiResult.emails ?? 0}</strong></div>
                    <div><small>Coincidencias</small><strong>{apiResult.matched ?? 0}</strong></div>
                    <div><small>≥ 10 min</small><strong>{apiResult.qualified ?? 0}</strong></div>
                    <div><small>Aplicadas</small><strong>{apiResult.applied ?? 0}</strong></div>
                  </div>

                  {Array.isArray(apiResult.results) && apiResult.results.length > 0 && (
                    <div className="zoom-results-table-wrapper">
                      <table className="zoom-results-table">
                        <thead>
                          <tr>
                            <th>Miembro</th>
                            <th>Correo</th>
                            <th>Círculo</th>
                            <th>Entradas</th>
                            <th>Minutos</th>
                            <th>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {apiResult.results.map((item, index) => (
                            <tr key={`${item.email}-${index}`}>
                              <td>{item.name || item.zoomName || "—"}</td>
                              <td>{item.email || "—"}</td>
                              <td>{item.circle || "—"}</td>
                              <td>{item.entries ?? item.instanceCount ?? 0}</td>
                              <td>{item.totalMinutes ?? 0}</td>
                              <td>
                                {["sync", "finalize"].includes(apiResult.mode) && item.willApply ? (
                                  <span className="zoom-status-present">✓ ASISTIÓ</span>
                                ) : item.willApply ? (
                                  <span className="zoom-status-present">✓ CUMPLE</span>
                                ) : (
                                  <span className="zoom-status-absent">SIN CAMBIOS</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
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

                  <option value="HEALTH">
                    🟦 HEALTH
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
                si el correo existe en el
                Directorio y acumula al menos
                10 minutos. Los demás quedan
                sin cambios. La falta se refleja
                en el Reporte Mensual cuando ya
                pasó el día de la reunión.
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
                                      SIN CAMBIOS
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