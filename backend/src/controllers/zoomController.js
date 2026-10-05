            const XLSX = require("xlsx");

            const User = require("../models/User");
            const Circle = require("../models/Circle");
            const Meeting = require("../models/Meeting");
            const Attendance = require("../models/Attendance");

            const {
              canManageGlobal,
              canManageCircle,
              getCircleScope,
            } = require("../middleware/permissionMiddleware");

            const {
              createAuditLog,
            } = require("../services/auditService");

            // ============================================================
            // CONFIGURACIÓN
            // ============================================================

            const ZOOM_MINUTES_REQUIRED = 10;

            const ALLOWED_SESSION_TYPES = [
              "HEALTH",
              "MASTERCLASS",
              "ANUNCIOS CORPORATIVOS",
            ];

            const HEALTH_CONFIG = {
              time: "19:00",
              endTime: "20:00",
              title: "HEALTH",
            };

            const MASTERCLASS_CONFIG = {
              day: 5, // Viernes
              time: "19:00",
              endTime: "20:00",
              title: "MASTERCLASS",
            };

            // ============================================================
            // NORMALIZADORES
            // ============================================================

            const normalizeHeader = (value) => {
              return String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim()
                .toLowerCase()
                .replace(/\s+/g, " ");
            };

            const cleanEmail = (value) => {
              return String(value ?? "")
                .trim()
                .toLowerCase();
            };

            const cleanDni = (value) => {
              if (
                value === null ||
                value === undefined
              ) {
                return "";
              }

              return String(value)
                .trim()
                .replace(/\.0+$/, "")
                .replace(/\s+/g, "");
            };

            const normalizeType = (value) => {
              const type = String(
                value || ""
              )
                .trim()
                .toUpperCase();

              if (
                type ===
                "CÍRCULO DE LIDERAZGO"
              ) {
                return "CIRCULO DE LIDERAZGO";
              }

              if (type === "MENTORÍA") {
                return "MENTORIA";
              }

              return type;
            };

            // ============================================================
            // COLUMNAS ZOOM
            // ============================================================

            const findColumn = (
              headers,
              aliases
            ) => {
              const normalizedHeaders =
                headers.map(
                  (header) =>
                    normalizeHeader(header)
                );

              const normalizedAliases =
                aliases.map(
                  (alias) =>
                    normalizeHeader(alias)
                );

              // Primero coincidencia exacta.
              for (
                const alias of normalizedAliases
              ) {
                const index =
                  normalizedHeaders.findIndex(
                    (header) =>
                      header === alias
                  );

                if (index >= 0) {
                  return headers[index];
                }
              }

              // Después coincidencia parcial.
              for (
                const alias of normalizedAliases
              ) {
                const index =
                  normalizedHeaders.findIndex(
                    (header) =>
                      header.includes(alias) ||
                      alias.includes(header)
                  );

                if (index >= 0) {
                  return headers[index];
                }
              }

              return null;
            };

            // ============================================================
            // MINUTOS
            // ============================================================

            const parseMinutes = (
              value
            ) => {
              if (
                typeof value ===
                  "number" &&
                Number.isFinite(value)
              ) {
                return Math.max(
                  0,
                  value
                );
              }

              const raw = String(
                value ?? ""
              )
                .trim()
                .replace(",", ".");

              if (!raw) {
                return 0;
              }

              const numeric =
                Number(raw);

              if (
                Number.isFinite(
                  numeric
                )
              ) {
                return Math.max(
                  0,
                  numeric
                );
              }

              const match =
                raw.match(
                  /(\d+(?:\.\d+)?)\s*(?:min|minute|minutes)/i
                );

              if (match) {
                return Math.max(
                  0,
                  Number(match[1])
                );
              }

              /*
               * Algunos reportes pueden traer
               * valores como:
               *
               * 00:12:35
               * 12:35
               *
               * Intentamos interpretarlos
               * como duración.
               */
              const timeMatch =
                raw.match(
                  /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
                );

              if (timeMatch) {
                const first =
                  Number(
                    timeMatch[1]
                  );

                const second =
                  Number(
                    timeMatch[2]
                  );

                const third =
                  timeMatch[3] !==
                  undefined
                    ? Number(
                        timeMatch[3]
                      )
                    : null;

                if (
                  third !== null
                ) {
                  return Math.max(
                    0,
                    first * 60 +
                      second +
                      third / 60
                  );
                }

                return Math.max(
                  0,
                  first +
                    second / 60
                );
              }

              return 0;
            };

            // ============================================================
            // FECHAS
            // ============================================================

            const pad = (
              value
            ) => {
              return String(
                value
              ).padStart(2, "0");
            };

            const dateToString = (
              date
            ) => {
              return `${date.getFullYear()}-${pad(
                date.getMonth() + 1
              )}-${pad(
                date.getDate()
              )}`;
            };

            const parseDateValue = (
              value
            ) => {
              if (
                value instanceof Date &&
                !Number.isNaN(
                  value.getTime()
                )
              ) {
                return dateToString(
                  value
                );
              }

              if (
                typeof value ===
                  "number" &&
                Number.isFinite(value)
              ) {
                try {
                  const parsed =
                    XLSX.SSF.parse_date_code(
                      value
                    );

                  if (
                    parsed &&
                    parsed.y &&
                    parsed.m &&
                    parsed.d
                  ) {
                    return `${parsed.y}-${pad(
                      parsed.m
                    )}-${pad(
                      parsed.d
                    )}`;
                  }
                } catch {
                  // continuar con otros formatos
                }
              }

              const raw = String(
                value ?? ""
              ).trim();

              if (!raw) {
                return "";
              }

              // YYYY-MM-DD
              let match =
                raw.match(
                  /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
                );

              if (match) {
                return `${match[1]}-${pad(
                  match[2]
                )}-${pad(
                  match[3]
                )}`;
              }

              // DD/MM/YYYY
              match =
                raw.match(
                  /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/
                );

              if (match) {
                return `${match[3]}-${pad(
                  match[2]
                )}-${pad(
                  match[1]
                )}`;
              }

              const parsed =
                new Date(raw);

              if (
                !Number.isNaN(
                  parsed.getTime()
                )
              ) {
                return dateToString(
                  parsed
                );
              }

              return "";
            };

            const parseTimeValue = (
              value
            ) => {
              if (
                value instanceof Date &&
                !Number.isNaN(
                  value.getTime()
                )
              ) {
                return `${pad(
                  value.getHours()
                )}:${pad(
                  value.getMinutes()
                )}`;
              }

              if (
                typeof value ===
                  "number" &&
                Number.isFinite(value)
              ) {
                /*
                 * Hora Excel como fracción
                 * del día.
                 */
                const totalMinutes =
                  Math.round(
                    value * 24 * 60
                  );

                const hours =
                  Math.floor(
                    totalMinutes / 60
                  ) % 24;

                const minutes =
                  totalMinutes % 60;

                return `${pad(
                  hours
                )}:${pad(minutes)}`;
              }

              const raw = String(
                value ?? ""
              ).trim();

              if (!raw) {
                return "";
              }

              /*
               * Si viene como fecha/hora.
               */
              const parsed =
                new Date(raw);

              if (
                !Number.isNaN(
                  parsed.getTime()
                ) &&
                /[T ]/.test(raw)
              ) {
                return `${pad(
                  parsed.getHours()
                )}:${pad(
                  parsed.getMinutes()
                )}`;
              }

              const match =
                raw.match(
                  /(\d{1,2}):(\d{2})/
                );

              if (match) {
                return `${pad(
                  match[1]
                )}:${pad(
                  match[2]
                )}`;
              }

              return "";
            };

            // ============================================================
            // FECHA DESDE HORA DE ENTRADA
            // ============================================================

            const getDetectedDate = (
              rows
            ) => {
              return {
                date: "",
                dates: [],
              };
            };

            // ============================================================
            // LECTURA DEL REPORTE
            // ============================================================

            const parseZoomFile = (
              buffer
            ) => {
              const workbook =
                XLSX.read(
                  buffer,
                  {
                    type: "buffer",
                    cellDates: true,
                    raw: true,
                  }
                );

              const sheetName =
                workbook.SheetNames[0];

              if (!sheetName) {
                throw new Error(
                  "El reporte de Zoom no contiene ninguna hoja."
                );
              }

              const worksheet =
                workbook.Sheets[sheetName];

              /*
               * NO usamos los nombres de las columnas de Zoom.
               *
               * El nuevo reporte se interpreta por posición:
               *
               * Fila 2 -> contiene la fecha del reporte.
               * Fila 4 -> encabezados de participantes.
               * Fila 5 en adelante -> participantes.
               *
               * En cada participante:
               * 0 = nombre
               * 1 = correo
               * 2 = hora de entrada
               * 3 = hora de salida
               * 4 = duración en minutos
               *
               * Esto funciona tanto si XLSX entrega la fila separada
               * en varias celdas como si todo llega dentro de A.
               */

              const matrix =
                XLSX.utils.sheet_to_json(
                  worksheet,
                  {
                    header: 1,
                    defval: "",
                    raw: true,
                  }
                );

              if (!matrix.length) {
                throw new Error(
                  "El reporte de Zoom está vacío."
                );
              }

              /* --------------------------------------------------------
               * FECHA: FILA 2
               * -------------------------------------------------------- */

              const secondRow =
                matrix[1] || [];

              const secondRowText =
                secondRow
                  .map((value) =>
                    String(value ?? "")
                  )
                  .join(",");

              const dateMatch =
                secondRowText.match(
                  /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{4})\b/
                );

              const detectedDate =
                dateMatch
                  ? parseDateValue(
                      dateMatch[1]
                    )
                  : "";

              if (!detectedDate) {
                throw new Error(
                  "No pude detectar la fecha del reporte de Zoom en la fila 2."
                );
              }

              /* --------------------------------------------------------
               * PARSER PARA UNA FILA QUE VIENE COMPLETA EN LA COLUMNA A
               * -------------------------------------------------------- */

              const parseCsvLine = (
                line
              ) => {
                const result = [];
                let current = "";
                let insideQuotes = false;

                for (
                  let index = 0;
                  index < line.length;
                  index++
                ) {
                  const char =
                    line[index];

                  if (char === '"') {
                    if (
                      insideQuotes &&
                      line[index + 1] === '"'
                    ) {
                      current += '"';
                      index++;
                      continue;
                    }

                    insideQuotes =
                      !insideQuotes;
                    continue;
                  }

                  if (
                    char === "," &&
                    !insideQuotes
                  ) {
                    result.push(
                      current.trim()
                    );
                    current = "";
                    continue;
                  }

                  current += char;
                }

                result.push(
                  current.trim()
                );

                return result;
              };

              /* --------------------------------------------------------
               * PARTICIPANTES: DESDE FILA 5
               * -------------------------------------------------------- */

              const participantRows =
                matrix.slice(4);

              const rows =
                participantRows
                  .map((rawRow) => {
                    let parts;

                    /*
                     * Si todo está en A, por ejemplo:
                     *
                     * Aldo Alanya,alanyaaldo@gmail.com,...,13,...
                     */
                    if (
                      rawRow.length === 1
                    ) {
                      const rawLine =
                        String(
                          rawRow[0] ?? ""
                        ).trim();

                      if (!rawLine) {
                        return null;
                      }

                      parts =
                        parseCsvLine(
                          rawLine
                        );
                    } else {
                      /*
                       * Si el lector CSV de XLSX ya separó las celdas,
                       * usamos exactamente las mismas posiciones.
                       * NO buscamos por nombre de columna.
                       */
                      parts = rawRow.map(
                        (value) =>
                          String(
                            value ?? ""
                          ).trim()
                      );
                    }

                    return {
                      name: String(
                        parts[0] || ""
                      ).trim(),

                      email: cleanEmail(
                        parts[1] || ""
                      ),

                      entry:
                        parts[2] || "",

                      exit:
                        parts[3] || "",

                      minutes:
                        parseMinutes(
                          parts[4] || ""
                        ),
                    };
                  })
                  .filter(
                    (row) =>
                      row &&
                      (
                        row.email ||
                        row.name ||
                        row.minutes > 0
                      )
                  );

              if (!rows.length) {
                throw new Error(
                  "No encontré participantes desde la fila 5 del reporte de Zoom."
                );
              }

              return {
                rows,
                records: rows.length,
                date: detectedDate,
              };
            };

            // ============================================================
            // CÍRCULOS PERMITIDOS
            // ============================================================

            const normalizeCircleKey = (value) => {
              return String(value || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .trim()
                .toUpperCase();
            };

            const getAllowedCircles = async (
              req
            ) => {
              const activeCircles =
                await Circle.find({
                  active: true,
                }).sort({
                  name: 1,
                });

              if (
                canManageGlobal(
                  req.user
                )
              ) {
                return activeCircles;
              }

              const scope =
                getCircleScope(
                  req.user
                );

              const allowed =
                new Set(
                  scope
                    .map((circle) =>
                      normalizeCircleKey(circle)
                    )
                    .filter(Boolean)
                );

              return activeCircles.filter((circle) =>
                allowed.has(
                  normalizeCircleKey(circle.name)
                )
              );
            };

            // ============================================================
            // REUNIÓN ZOOM
            // ============================================================

            const getLimaWeekday = (
              date
            ) => {
              const parsed =
                new Date(
                  `${date}T12:00:00-05:00`
                );

              if (
                Number.isNaN(
                  parsed.getTime()
                )
              ) {
                return null;
              }

              return parsed.getDay();
            };

            const getOrCreateZoomMeeting =
              async ({
                circle,
                type,
                date,
                rows,
                req,
              }) => {
                const normalizedType =
                  normalizeType(type);

                if (
                  !canManageCircle(
                    req.user,
                    circle
                  )
                ) {
                  throw new Error(
                    `No tienes permisos para procesar el círculo "${circle}".`
                  );
                }

                let meeting =
                  await Meeting.findOne({
                    circle,
                    type:
                      normalizedType,
                    date,
                    active: true,
                  }).sort({
                    createdAt: 1,
                  });

                if (meeting) {
                  meeting._createdByZoom = false;
                  return meeting;
                }

                let time = "00:00";
                let endTime = "00:00";
                let title =
                  normalizedType;
                let location = "Zoom";

                if (
                  normalizedType ===
                  "HEALTH"
                ) {
                  /*
                   * HEALTH se procesa según la orden seleccionada.
                   * La fecha NO cambia el tipo.
                   * Tampoco se bloquea por el día de la semana.
                   */
                  time =
                    HEALTH_CONFIG.time;

                  endTime =
                    HEALTH_CONFIG.endTime;

                  title =
                    HEALTH_CONFIG.title;

                  location =
                    "Virtual / Presencial";
                } else if (
                  normalizedType ===
                  "MASTERCLASS"
                ) {
                  /*
                   * MASTERCLASS solamente corresponde a viernes.
                   *
                   * IMPORTANTE:
                   * El viernes NO convierte automáticamente un reporte
                   * en MASTERCLASS. El tipo siempre viene de sessionType.
                   *
                   * Esta validación solo evita crear una MASTERCLASS
                   * si el Administrador seleccionó MASTERCLASS para una
                   * fecha que no es viernes.
                   */
                  const weekday =
                    getLimaWeekday(
                      date
                    );

                  if (
                    weekday !==
                    MASTERCLASS_CONFIG.day
                  ) {
                    throw new Error(
                      `La fecha ${date} no corresponde a una MASTERCLASS. MASTERCLASS solo utiliza sesiones de los viernes.`
                    );
                  }

                  time =
                    MASTERCLASS_CONFIG.time;

                  endTime =
                    MASTERCLASS_CONFIG.endTime;

                  title =
                    MASTERCLASS_CONFIG.title;

                  location =
                    "Zoom";
                } else {
                  /*
                   * ANUNCIOS CORPORATIVOS:
                   * usa exactamente la fecha detectada.
                   *
                   * Nunca se convierte automáticamente en
                   * MASTERCLASS por ser viernes.
                   */
                  const entryTimes =
                    rows
                      .map(
                        (row) =>
                          parseTimeValue(
                            row.entry
                          )
                      )
                      .filter(Boolean)
                      .sort();

                  const exitTimes =
                    rows
                      .map(
                        (row) =>
                          parseTimeValue(
                            row.exit
                          )
                      )
                      .filter(Boolean)
                      .sort();

                  time =
                    entryTimes[0] ||
                    "00:00";

                  endTime =
                    exitTimes[
                      exitTimes.length - 1
                    ] ||
                    time;

                  title =
                    "ANUNCIOS CORPORATIVOS";

                  location = "Zoom";
                }

                meeting =
                  await Meeting.create({
                    title,
                    type:
                      normalizedType,
                    circle,
                    host: "Sistema",
                    date,
                    time,
                    endTime,
                    location,
                    active: true,
                    createdBy:
                      req.user?.adminId ||
                      req.user?.name ||
                      "",
                    attendees: [],
                  });

                /*
                 * Marca únicamente en memoria que esta reunión fue creada
                 * por este procesamiento de Zoom. No se guarda este campo
                 * en MongoDB.
                 */
                meeting._createdByZoom = true;

                return meeting;
              };

            // ============================================================
            // GUARDAR ASISTENCIA
            // ============================================================

            const saveZoomAttendance =
              async ({
                meeting,
                user,
                attended,
                totalMinutes,
              }) => {
                const status =
                  attended
                    ? "Asistió"
                    : "No asistió";

                let attendance =
                  await Attendance.findOne(
                    {
                      meeting:
                        meeting._id,
                      user:
                        user._id,
                    }
                  );

                if (attendance && attendance.active === false) {
                  attendance.active = true;
                  attendance.deletedAt = null;
                  attendance.deletedBy = "";
                }

                if (!attendance) {
                  attendance =
                    new Attendance({
                      meeting:
                        meeting._id,
                      user:
                        user._id,
                      active: true,
                    });
                }

                attendance.doc =
                  user.doc;

                attendance.name =
                  user.name;

                attendance.circle =
                  user.circle;

                attendance.status =
                  status;

                attendance.source =
                  "SYSTEM";

                attendance.attendanceMode =
                  "MANUAL";

                attendance.registeredBy =
                  "ZOOM";

                attendance.registeredAt =
                  new Date();

                attendance.note = "";
                attendance.notes = "";

                attendance.justificationReason =
                  "";

                attendance.justifiedAt =
                  null;

                attendance.justifiedBy =
                  "";

                attendance.attendedAt =
                  attended
                    ? new Date()
                    : null;

                await attendance.save();

                /*
                 * Mantener Meeting.attendees
                 * sincronizado.
                 */
                if (
                  !Array.isArray(
                    meeting.attendees
                  )
                ) {
                  meeting.attendees = [];
                }

                const attendeeIndex =
                  meeting.attendees.indexOf(
                    user.doc
                  );

                if (
                  attended &&
                  attendeeIndex === -1
                ) {
                  meeting.attendees.push(
                    user.doc
                  );
                }

                if (
                  !attended &&
                  attendeeIndex !== -1
                ) {
                  meeting.attendees.splice(
                    attendeeIndex,
                    1
                  );
                }

                return attendance;
              };

            // ============================================================
            // INFO
            // ============================================================

            const getInfo = async (
              req,
              res
            ) => {
              try {
                const allowedCircles =
                  await getAllowedCircles(
                    req
                  );

                const circleNames =
                  allowedCircles.map(
                    (circle) =>
                      circle.name
                  );

                const userQuery =
                  canManageGlobal(
                    req.user
                  )
                    ? {}
                    : {
                        circle: {
                          $in: circleNames,
                        },
                      };

                const members =
                  await User.countDocuments(
                    userQuery
                  );

                return res.json({
                  members,
                  records: 0,
                  emails: 0,
                  detectedDate: "",
                  circles:
                    allowedCircles.length,
                });
              } catch (error) {
                console.error(
                  "[Zoom] Error obteniendo información:",
                  error
                );

                return res.status(500).json({
                  message:
                    "No se pudo obtener la información de Zoom.",
                });
              }
            };

            // ============================================================
            // PROCESAR REPORTE
            // ============================================================

            const processReport = async (
              req,
              res
            ) => {
              try {
                if (!req.file) {
                  return res.status(400).json({
                    message:
                      "Selecciona un reporte de Zoom.",
                  });
                }

                const sessionType =
                  normalizeType(
                    req.body.sessionType
                  );

                if (
                  !ALLOWED_SESSION_TYPES.includes(
                    sessionType
                  )
                ) {
                  return res.status(400).json({
                    message:
                      "Selecciona un tipo de sesión válido.",
                  });
                }

                /*
                 * Moderador = solo lectura.
                 */
                if (!canManageGlobal(req.user)) {
                  const scope = getCircleScope(req.user);

                  if (!scope.length) {
                    return res.status(403).json({
                      message:
                        "Tu usuario no tiene círculos asignados para procesar asistencia de Zoom.",
                    });
                  }

                  const hasManageableCircle = scope.some((circle) =>
                    canManageCircle(req.user, circle)
                  );

                  if (!hasManageableCircle) {
                    return res.status(403).json({
                      message:
                        "Tu usuario no tiene permisos para procesar asistencia de Zoom.",
                    });
                  }
                }

                // ----------------------------------------------------------
                // LEER REPORTE
                // ----------------------------------------------------------

                const parsed =
                  parseZoomFile(
                    req.file.buffer
                  );

                const rows =
                  parsed.rows;

                // La fecha oficial del reporte SIEMPRE sale de la fila 2.
                // Las fechas de entrada/salida de los participantes no
                // participan en la detección ni validación de la reunión.
                const date = parsed.date;

                if (!date) {
                  return res.status(400).json({
                    message:
                      "No pude detectar la fecha del reporte de Zoom en la fila 2.",
                  });
                }

                // ----------------------------------------------------------
                // CÍRCULOS PERMITIDOS
                // ----------------------------------------------------------

                const allowedCircles =
                  await getAllowedCircles(
                    req
                  );

                if (
                  !allowedCircles.length
                ) {
                  return res.status(403).json({
                    message:
                      "No tienes círculos asignados para procesar asistencia.",
                  });
                }

                const allowedCircleNames =
                  allowedCircles.map(
                    (circle) =>
                      circle.name
                  );

                const allowedCircleKeys =
                  new Set(
                    allowedCircleNames.map(
                      (circle) =>
                        String(
                          circle
                        )
                          .trim()
                          .toUpperCase()
                    )
                  );

                // ----------------------------------------------------------
                // MIEMBROS DEL DIRECTORIO
                // ----------------------------------------------------------

                const userQuery =
                  canManageGlobal(
                    req.user
                  )
                    ? {}
                    : {
                        circle: {
                          $in:
                            allowedCircleNames,
                        },
                      };

                const members =
                  await User.find(
                    userQuery
                  ).sort({
                    name: 1,
                  });

                if (!members.length) {
                  return res.status(400).json({
                    message:
                      "No hay miembros disponibles en los círculos que puedes gestionar.",
                  });
                }

                // ----------------------------------------------------------
                // AGRUPAR ZOOM POR CORREO
                // ----------------------------------------------------------

                const rowsByEmail =
                  new Map();

                const minutesByEmail =
                  new Map();

                for (
                  const row of rows
                ) {
                  const email =
                    cleanEmail(
                      row.email
                    );

                  if (!email) {
                    continue;
                  }

                  if (
                    !rowsByEmail.has(
                      email
                    )
                  ) {
                    rowsByEmail.set(
                      email,
                      []
                    );
                  }

                  rowsByEmail
                    .get(email)
                    .push(row);

                  const current =
                    minutesByEmail.get(
                      email
                    ) || 0;

                  minutesByEmail.set(
                    email,
                    current +
                      parseMinutes(
                        row.minutes
                      )
                  );
                }

                // ----------------------------------------------------------
                // ÍNDICE DE MIEMBROS
                // ----------------------------------------------------------

                const membersByEmail =
                  new Map();

                const membersByDni =
                  new Map();

                for (
                  const member of members
                ) {
                  const email =
                    cleanEmail(
                      member.email
                    );

                  if (email) {
                    membersByEmail.set(
                      email,
                      member
                    );
                  }

                  const dni =
                    cleanDni(
                      member.doc
                    );

                  if (dni) {
                    membersByDni.set(
                      dni,
                      member
                    );
                  }
                }

                // ----------------------------------------------------------
                // CORREOS NO ENCONTRADOS
                // ----------------------------------------------------------

                let unmatched = 0;

                rowsByEmail.forEach(
                  (
                    _rows,
                    email
                  ) => {
                    if (
                      !membersByEmail.has(
                        email
                      )
                    ) {
                      unmatched++;
                    }
                  }
                );

                // ----------------------------------------------------------
                // AGRUPAR MIEMBROS POR CÍRCULO
                // ----------------------------------------------------------

                const membersByCircle =
                  new Map();

                for (
                  const member of members
                ) {
                  const rawCircle =
                    String(
                      member.circle || ""
                    ).trim();

                  const circleKey =
                    rawCircle.toUpperCase();

                  if (
                    !rawCircle ||
                    !allowedCircleKeys.has(
                      circleKey
                    )
                  ) {
                    continue;
                  }

                  const activeCircle =
                    allowedCircles.find(
                      (circle) =>
                        normalizeCircleKey(circle.name) ===
                        circleKey
                    );

                  if (
                    !activeCircle
                  ) {
                    continue;
                  }

                  const circleName =
                    activeCircle.name;

                  if (
                    !membersByCircle.has(
                      circleKey
                    )
                  ) {
                    membersByCircle.set(
                      circleKey,
                      {
                        circle:
                          circleName,
                        members: [],
                      }
                    );
                  }

                  membersByCircle
                    .get(circleKey)
                    .members.push(
                      member
                    );
                }

                // ----------------------------------------------------------
                // PROCESAR CADA CÍRCULO
                // ----------------------------------------------------------

                let present = 0;
                let skipped = 0;

                const meetings = [];
                const results = [];

                /*
                 * Cambios realizados por ESTE procesamiento de Zoom.
                 * Se guardan en la Bitácora como un único lote reversible.
                 */
                const zoomAttendanceChanges = [];
                const zoomMeetingChanges = [];
                const zoomMeetingChangeMap = new Map();

                for (
                  const group of membersByCircle.values()
                ) {
                  if (
                    !canManageGlobal(req.user) &&
                    !canManageCircle(req.user, group.circle)
                  ) {
                    continue;
                  }

                  const meeting =
                    await getOrCreateZoomMeeting(
                      {
                        circle:
                          group.circle,
                        type:
                          sessionType,
                        date,
                        rows,
                        req,
                      }
                    );

                  const meetingKey =
                    String(meeting._id);

                  if (
                    !zoomMeetingChangeMap.has(
                      meetingKey
                    )
                  ) {
                    const meetingSnapshot = {
                      meetingId:
                        meeting._id,
                      circle:
                        meeting.circle,
                      meetingType:
                        meeting.type,
                      meetingDate:
                        meeting.date,
                      meetingTitle:
                        meeting.title,
                      wasCreated:
                        Boolean(
                          meeting._createdByZoom
                        ),
                      previousAttendees:
                        Array.isArray(
                          meeting.attendees
                        )
                          ? [...meeting.attendees]
                          : [],
                      afterUpdatedAt:
                        null,
                    };

                    zoomMeetingChanges.push(
                      meetingSnapshot
                    );

                    zoomMeetingChangeMap.set(
                      meetingKey,
                      meetingSnapshot
                    );
                  }

                  if (
                    !meetings.some(
                      (item) =>
                        String(
                          item._id
                        ) ===
                        String(
                          meeting._id
                        )
                    )
                  ) {
                    meetings.push(
                      meeting
                    );
                  }

                  for (
                    const member of group.members
                  ) {
                    const email =
                      cleanEmail(
                        member.email
                      );

                    const zoomRows =
                      email
                        ? rowsByEmail.get(
                            email
                          ) || []
                        : [];

                    const totalMinutes =
                      email
                        ? Number(
                            (
                              minutesByEmail.get(
                                email
                              ) || 0
                            ).toFixed(2)
                          )
                        : 0;

                    /*
                     * REGLA EXACTA DE TU BASE:
                     *
                     * correo del Directorio
                     * +
                     * aparición en Zoom
                     * +
                     * mínimo 10 minutos.
                     */
                    const attended =
                      Boolean(
                        email &&
                          zoomRows.length >
                            0 &&
                          totalMinutes >=
                            ZOOM_MINUTES_REQUIRED
                      );

                    /*
                     * IMPORTANTE:
                     *
                     * Zoom solo modifica datos cuando el miembro aparece
                     * en el reporte y acumula al menos 10 minutos.
                     *
                     * Si no aparece, o aparece con menos de 10 minutos,
                     * no se crea ni se modifica Attendance. Esto permite
                     * subir varios reportes de una misma reunión durante
                     * el día sin borrar asistencias anteriores ni generar
                     * faltas artificiales.
                     */
                    if (!attended) {
                      skipped++;
                      continue;
                    }

                    const existingAttendance =
                      await Attendance.findOne({
                        meeting:
                          meeting._id,
                        user:
                          member._id,
                      }).lean();

                    const previousAttendance =
                      existingAttendance
                        ? {
                            active:
                              existingAttendance.active !==
                              undefined
                                ? existingAttendance.active
                                : true,
                            deletedAt:
                              existingAttendance.deletedAt ||
                              null,
                            deletedBy:
                              existingAttendance.deletedBy ||
                              "",
                            doc:
                              existingAttendance.doc ||
                              "",
                            name:
                              existingAttendance.name ||
                              "",
                            circle:
                              existingAttendance.circle ||
                              "",
                            status:
                              existingAttendance.status ||
                              "No asistió",
                            justificationReason:
                              existingAttendance.justificationReason ||
                              "",
                            justifiedBy:
                              existingAttendance.justifiedBy ||
                              "",
                            justifiedAt:
                              existingAttendance.justifiedAt ||
                              null,
                            registeredBy:
                              existingAttendance.registeredBy ||
                              "",
                            source:
                              existingAttendance.source ||
                              "ADMIN",
                            attendanceMode:
                              existingAttendance.attendanceMode ||
                              "MANUAL",
                            attendedAt:
                              existingAttendance.attendedAt ||
                              null,
                            registeredAt:
                              existingAttendance.registeredAt ||
                              null,
                            note:
                              existingAttendance.note ||
                              "",
                            notes:
                              existingAttendance.notes ||
                              "",
                          }
                        : null;

                    const savedAttendance =
                      await saveZoomAttendance(
                        {
                          meeting,
                          user: member,
                          attended: true,
                          totalMinutes,
                        }
                      );

                    zoomAttendanceChanges.push({
                      attendanceId:
                        savedAttendance._id,
                      meetingId:
                        meeting._id,
                      memberDoc:
                        member.doc || "",
                      memberName:
                        member.name || "",
                      memberEmail:
                        member.email || "",
                      circle:
                        group.circle,
                      wasCreated:
                        !existingAttendance,
                      previousAttendance,
                      previousStatus:
                        previousAttendance?.status ||
                        "",
                      newStatus:
                        savedAttendance.status,
                      afterUpdatedAt:
                        savedAttendance.updatedAt,
                    });

                    present++;

                    results.push({
                      dni:
                        member.doc || "",

                      name:
                        member.name || "",

                      email:
                        member.email || "",

                      circle:
                        group.circle,

                      zoomEmail: email,

                      totalMinutes,

                      status: "ASISTIÓ",

                      meetingId:
                        meeting._id,
                    });
                  }

                  await meeting.save();

                  const meetingChange =
                    zoomMeetingChangeMap.get(
                      String(meeting._id)
                    );

                  if (meetingChange) {
                    meetingChange.afterUpdatedAt =
                      meeting.updatedAt;
                  }
                }

                // ----------------------------------------------------------
                // AUDITORÍA
                // ----------------------------------------------------------

                const reversibleZoom =
                  zoomAttendanceChanges.length > 0 ||
                  zoomMeetingChanges.some(
                    (item) =>
                      item.wasCreated
                  );

                await createAuditLog({
                  admin:
                    req.user,

                  action:
                    "Procesó asistencia de Zoom",

                  module:
                    "zoom",

                  description:
                    `Procesamiento Zoom de ${sessionType} del ${date}: ${present} asistencias aplicadas, ${unmatched} correos no encontrados. Los miembros que no pasaron el filtro quedaron sin cambios.`,

                  targetId:
                    `${sessionType}-${date}`,

                  targetName:
                    `${sessionType} ${date}`,

                  circle:
                    canManageGlobal(
                      req.user
                    )
                      ? "GLOBAL"
                      : allowedCircleNames.join(
                          ", "
                        ),

                  reversible:
                    true,

                  metadata: {
                    fileName:
                      req.file.originalname,

                    sessionType,

                    detectedDate:
                      date,

                    meetingDate:
                      date,

                    meetingType:
                      sessionType,

                    meetingTitle:
                      sessionType,

                    records:
                      rows.length,

                    emails:
                      rowsByEmail.size,

                    members:
                      members.length,

                    circles:
                      meetings.length,

                    present,

                    skipped,

                    unmatched,

                    minimumMinutes:
                      ZOOM_MINUTES_REQUIRED,

                    attendanceChanges:
                      zoomAttendanceChanges,

                    meetingChanges:
                      zoomMeetingChanges,
                  },
                });

                // ----------------------------------------------------------
                // RESPUESTA
                // ----------------------------------------------------------

                return res.json({
                  success: true,

                  message:
                    "Asistencia de Zoom procesada correctamente.",

                  records:
                    rows.length,

                  emails:
                    rowsByEmail.size,

                  detectedDate:
                    date,

                  applied:
                    results.length,

                  processed:
                    results.length,

                  present,

                  absent: 0,

                  skipped,

                  unmatched,

                  circles:
                    meetings.map(
                      (meeting) =>
                        meeting.circle
                    ),

                  meetings:
                    meetings.map(
                      (meeting) => ({
                        id:
                          meeting._id,

                        circle:
                          meeting.circle,

                        type:
                          meeting.type,

                        date:
                          meeting.date,
                      })
                    ),

                  results,
                });
              } catch (error) {
                console.error(
                  "[Zoom] Error procesando reporte:",
                  error
                );

                return res.status(500).json({
                  message:
                    error.message ||
                    "No se pudo procesar el reporte de Zoom.",
                });
              }
            };

            module.exports = {
              getInfo,
              processReport,
            };
