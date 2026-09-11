
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import reportService from "../services/reportService";
import circleService from "../services/circleService";
import { useAuth } from "../context/AuthContext";
import "../styles/reports.css";

const CATEGORY_ORDER = [
  "CIRCULO DE LIDERAZGO",
  "HEALTH",
  "MENTORIA",
  "MASTERCLASS",
  "ANUNCIOS CORPORATIVOS",
];

const CATEGORY_LABELS = {
  "CIRCULO DE LIDERAZGO":
    "CÍRCULO DE LIDERAZGO",

  HEALTH: "HEALTH",

  MENTORIA: "MENTORÍA",

  MASTERCLASS: "MASTERCLASS",

  "ANUNCIOS CORPORATIVOS":
    "ANUNCIOS CORPORATIVOS",
};

const normalizeStatus = (status) => {
  const value = String(status || "")
    .trim()
    .toUpperCase();

  if (
    value === "ASISTIO" ||
    value === "ASISTIÓ"
  ) {
    return "Asistió";
  }

  if (
    value === "CLASE PRESENCIAL"
  ) {
    return "Clase Presencial";
  }

  if (
    value === "JUSTIFICADO" ||
    value === "FALTA JUSTIFICADA"
  ) {
    return "Justificado";
  }

  if (value === "PENDIENTE") {
    return "";
  }

  return "No asistió";
};

const statusClass = (item) => {
  const status =
    normalizeStatus(item?.status);

  if (
    status === "Justificado" &&
    item?.justificationValidity ===
      "valid"
  ) {
    return "justified-valid";
  }

  if (
    status === "Justificado" &&
    item?.justificationValidity ===
      "extra"
  ) {
    return "justified-extra";
  }

  if (
    status === "Asistió"
  ) {
    return "attended";
  }

  if (
    status === "Clase Presencial"
  ) {
    return "presential";
  }

  if (!status) {
    return "empty";
  }

  return "absent";
};

const statusLabel = (item) => {
  const status =
    normalizeStatus(item?.status);

  if (
    status === "Asistió"
  ) {
    return "✓";
  }

  if (
    status === "Clase Presencial"
  ) {
    return "P";
  }

  if (
    status === "Justificado"
  ) {
    return "J";
  }

  if (!status) {
    return "";
  }

  return "F";
};

const formatSessionHeader = (
  session
) => {
  if (!session) {
    return "";
  }

  const date = String(
    session.date || ""
  ).slice(0, 10);

  const parts =
    date.split("-");

  if (
    parts.length === 3
  ) {
    return `${parts[2]}/${parts[1]}`;
  }

  return date;
};

const MonthlyReport = () => {
  const today = new Date();
  const { admin } = useAuth();

  const isCircleManager =
    String(admin?.role || "").trim() ===
    "Gestor de Círculo";

  const [year, setYear] =
    useState(
      today.getFullYear()
    );

  const [month, setMonth] =
    useState(
      today.getMonth() + 1
    );

  const [report, setReport] =
    useState(null);

  const [search, setSearch] =
    useState("");

  const [circle, setCircle] =
    useState("");

  const [availableCircles, setAvailableCircles] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /*
   * Los gestores solamente deben recibir los círculos
   * que tienen asignados. El Administrador Principal
   * conserva la opción de consultar todos.
   */
  useEffect(() => {
    let cancelled = false;

    const loadCircles = async () => {
      try {
        const response =
          await circleService.getCircles();

        const list =
          Array.isArray(response)
            ? response
            : Array.isArray(response?.circles)
            ? response.circles
            : Array.isArray(response?.data)
            ? response.data
            : [];

        const names = [
          ...new Set(
            list
              .map((item) =>
                typeof item === "string"
                  ? item
                  : item?.name
              )
              .map((name) =>
                String(name || "").trim()
              )
              .filter(Boolean)
          ),
        ];

        if (cancelled) return;

        setAvailableCircles(names);

        if (isCircleManager) {
          setCircle((current) => {
            const currentName =
              String(current || "").trim();

            if (
              currentName &&
              names.includes(currentName)
            ) {
              return currentName;
            }

            return names[0] || "";
          });
        }
      } catch (err) {
        console.error(
          "Error cargando círculos del reporte:",
          err
        );

        if (!cancelled) {
          setAvailableCircles([]);
        }
      }
    };

    loadCircles();

    return () => {
      cancelled = true;
    };
  }, [isCircleManager]);

  const loadReport =
    useCallback(
      async () => {
        /*
         * Un Gestor de Círculo necesita un círculo
         * seleccionado. Evitamos enviar una consulta
         * vacía que el backend rechaza correctamente.
         */
        if (
          isCircleManager &&
          !String(circle || "").trim()
        ) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError("");

          const response =
            await reportService.getMonthlyReport(
              year,
              month,
              circle
            );

          setReport(
            response?.data ||
              response?.report ||
              response ||
              null
          );
        } catch (err) {
          console.error(err);

          setError(
            err.message ||
              "No se pudo cargar el reporte."
          );

          setReport(null);
        } finally {
          setLoading(false);
        }
      },
      [
        year,
        month,
        circle,
        isCircleManager,
      ]
    );

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const moveMonth = (
    amount
  ) => {
    let nextMonth =
      month + amount;

    let nextYear = year;

    if (
      nextMonth > 12
    ) {
      nextMonth = 1;
      nextYear += 1;
    }

    if (
      nextMonth < 1
    ) {
      nextMonth = 12;
      nextYear -= 1;
    }

    setMonth(nextMonth);
    setYear(nextYear);
  };

  const members =
    Array.isArray(
      report?.members
    )
      ? report.members
      : [];

  const filteredMembers =
    useMemo(() => {
      const searchValue =
        search
          .trim()
          .toLowerCase();

      return members.filter(
        (member) => {
          const text = [
            member?.name,
            member?.doc,
            member?.circle,
            member?.user?.name,
            member?.user?.doc,
            member?.user?.circle,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return (
            !searchValue ||
            text.includes(
              searchValue
            )
          );
        }
      );
    }, [
      members,
      search,
    ]);

  const circles = useMemo(() => {
    /*
     * IMPORTANTE:
     * No derivamos los círculos desde `members`.
     *
     * Cuando el gestor seleccionaba un círculo,
     * el backend devolvía solamente sus miembros,
     * por lo que el selector terminaba mostrando
     * únicamente ese círculo y no permitía cambiar
     * entre todos los círculos asignados.
     *
     * `circleService.getCircles()` ya devuelve el
     * alcance correcto para cada usuario.
     */
    if (isCircleManager) {
      return availableCircles;
    }

    return availableCircles;
  }, [
    availableCircles,
    isCircleManager,
  ]);

  const summary =
    report?.summary || {};

  const sessionsByType =
    report?.sessionsByType ||
    {};

  /*
   * ============================================================
   * CATEGORÍAS VISIBLES
   * ============================================================
   *
   * Solo mostramos categorías que
   * realmente tienen reuniones en el
   * calendario durante este mes.
   *
   * Por ejemplo:
   *
   * HEALTH      -> sí tiene sesiones -> aparece
   * MENTORÍA    -> sí tiene sesiones -> aparece
   * MASTERCLASS -> no fue creada -> NO aparece
   * LIDERAZGO   -> no fue creada -> NO aparece
   * ANUNCIOS    -> no fue creada -> NO aparece
   */
  const visibleCategories =
    useMemo(() => {
      return CATEGORY_ORDER.filter(
        (category) => {
          const sessions =
            sessionsByType[
              category
            ];

          return (
            Array.isArray(
              sessions
            ) &&
            sessions.length > 0
          );
        }
      );
    }, [sessionsByType]);

  const getCategorySessions =
    (category) => {
      const sessions =
        sessionsByType[
          category
        ];

      return Array.isArray(
        sessions
      )
        ? sessions
        : [];
    };

  const getMemberSession = (
    member,
    session
  ) => {
    const memberCircle =
      String(
        member?.circle ||
          member?.user?.circle ||
          ""
      )
        .trim()
        .toLowerCase();

    const sessionCircle =
      String(
        session?.circle ||
          ""
      )
        .trim()
        .toLowerCase();

    /*
     * Nunca mostramos la asistencia
     * de una reunión perteneciente
     * a otro círculo.
     */
    if (
      memberCircle &&
      sessionCircle &&
      memberCircle !==
        sessionCircle
    ) {
      return null;
    }

    const category =
      session?.category;

    const sessions =
      member?.categories?.[
        category
      ]?.sessions;

    if (
      !Array.isArray(
        sessions
      )
    ) {
      return null;
    }

    return (
      sessions.find(
        (item) =>
          String(
            item?.meetingId
          ) ===
          String(
            session?.meetingId
          )
      ) || null
    );
  };

  const reportTitle =
    new Date(
      year,
      month - 1,
      1
    ).toLocaleDateString(
      "es-PE",
      {
        month: "long",
        year: "numeric",
      }
    );

  const getMemberTotals = (member) => {
    const totals = member?.totals || {};
    return {
      sessions: Number(totals.sessions || 0),
      attended: Number(totals.attended || 0),
      absent: Number(totals.absent || 0),
      pending: Number(totals.pending || 0),
      percentage: Number(totals.percentage || 0),
      bonus: Boolean(totals.bonus),
    };
  };

  const loadExcelJS = async () => {
    if (window.ExcelJS) {
      return window.ExcelJS;
    }

    await new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-circulos-exceljs="true"]'
      );

      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
      script.async = true;
      script.dataset.circulosExceljs = "true";
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error("No se pudo cargar el generador Excel."));
      document.head.appendChild(script);
    });

    if (!window.ExcelJS) {
      throw new Error("ExcelJS no está disponible.");
    }

    return window.ExcelJS;
  };

  const downloadExcel = async () => {
    if (!report || !filteredMembers.length) {
      setError("No hay datos del reporte para exportar.");
      return;
    }

    const button = document.getElementById(
      "monthly-report-download-excel"
    );

    try {
      if (button) {
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = "⏳ Preparando Excel...";
      }

      const ExcelJS = await loadExcelJS();
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Círculos Connect";
      workbook.created = new Date();
      workbook.modified = new Date();
      workbook.properties = {
        title: `Reporte Mensual de ${reportTitle}`,
        subject: "Reporte mensual de asistencia",
        company: "Círculos Connect",
      };

      // ==========================================================
      // PALETA EXACTA DE LA VISTA WEB
      // ==========================================================
      const COLORS = {
        night: "FF0B1736",
        night2: "FF102657",
        blue: "FF2457C5",
        blue2: "FF5F8FF5",
        cyan: "FF58CFE1",
        purple: "FF7654C6",
        grayBlue: "FF47576C",
        white: "FFFFFFFF",
        surface: "FFF8FAFC",
        tableHead: "FFF3F6FA",
        border: "FFD4DEED",
        borderLight: "FFE2E8F0",
        text: "FF0F172A",
        textSecondary: "FF334155",
        muted: "FF64748B",
        success: "FF10B981",
        successDark: "FF047857",
        successSoft: "FFEAF8EF",
        danger: "FFE11D48",
        dangerDark: "FFBE123C",
        dangerSoft: "FFFFF1F1",
        warning: "FFF59E0B",
        warningDark: "FFB45309",
        warningSoft: "FFFFF7E8",
        presential: "FF37669A",
        presentialSoft: "FFF3F8FF",
        empty: "FFFCFCFD",
      };

      const FONT = "Inter";
      const thinBorder = {
        top: { style: "thin", color: { argb: COLORS.borderLight } },
        left: { style: "thin", color: { argb: COLORS.borderLight } },
        bottom: { style: "thin", color: { argb: COLORS.borderLight } },
        right: { style: "thin", color: { argb: COLORS.borderLight } },
      };
      const whiteBorder = {
        top: { style: "thin", color: { argb: COLORS.border } },
        left: { style: "thin", color: { argb: COLORS.border } },
        bottom: { style: "thin", color: { argb: COLORS.border } },
        right: { style: "thin", color: { argb: COLORS.border } },
      };

      const categoryColors = {
        "CIRCULO DE LIDERAZGO": COLORS.blue,
        HEALTH: COLORS.cyan,
        MENTORIA: COLORS.purple,
        MASTERCLASS: "FF7A8492",
        "ANUNCIOS CORPORATIVOS": COLORS.night,
      };

      const statusStyles = {
        attended: [COLORS.successSoft, "FF237346"],
        presential: [COLORS.presentialSoft, COLORS.presential],
        "justified-valid": [COLORS.successSoft, "FF237346"],
        "justified-extra": [COLORS.dangerSoft, COLORS.dangerDark],
        absent: [COLORS.dangerSoft, COLORS.dangerDark],
        pending: ["FFF6F7F9", COLORS.muted],
      };

      // ==========================================================
      // HOJA PRINCIPAL — MISMA JERARQUÍA VISUAL QUE LA PÁGINA
      // ==========================================================
      const worksheet = workbook.addWorksheet("Reporte Mensual", {
        views: [{ state: "frozen", xSplit: 1, ySplit: 8, showGridLines: false }],
        properties: { defaultRowHeight: 20 },
      });


      const sessionColumns = [];
      visibleCategories.forEach((category) => {
        getCategorySessions(category).forEach((session) => {
          sessionColumns.push({ category, session });
        });
      });

      const baseHeaders = [
        "DNI",
        "NOMBRE",
        "USUARIO",
        "CÍRCULO",
        "RANGO / CARGO",
        "CORREO",
        "TELÉFONO",
      ];

      const summaryHeaders = ["ASIST.", "FALTAS", "%", "BONO"];

      const totalExcelColumns =
        baseHeaders.length + sessionColumns.length + summaryHeaders.length;

      // Título principal.
      worksheet.mergeCells(1, 1, 1, totalExcelColumns);
      const titleCell = worksheet.getCell(1, 1);
      titleCell.value = `Reporte Mensual de ${reportTitle}`;
      titleCell.font = {
        name: FONT,
        size: 16,
        bold: true,
        color: { argb: COLORS.white },
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.night },
      };
      titleCell.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      worksheet.getRow(1).height = 32;

      // Subtítulo / círculo actual.
      worksheet.mergeCells(2, 1, 2, totalExcelColumns);
      const subtitleCell = worksheet.getCell(2, 1);
      subtitleCell.value = `Círculo: ${circle || "Todos los círculos"}`;
      subtitleCell.font = {
        name: FONT,
        size: 10,
        italic: true,
        color: { argb: COLORS.muted },
      };
      subtitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.surface },
      };
      subtitleCell.alignment = {
        horizontal: "left",
        vertical: "middle",
      };
      worksheet.getRow(2).height = 24;

      // ==========================================================
      // TARJETAS DE RESUMEN — COMO LAS 5 TARJETAS DE LA WEB
      // ==========================================================
      const summaryCards = [
        {
          label: "Participantes",
          value: summary.participants ?? summary.members ?? members.length,
          color: COLORS.blue,
          icon: "👥",
        },
        {
          label: "Sesiones",
          value: summary.sessions ?? 0,
          color: COLORS.grayBlue,
          icon: "🗓",
        },
        {
          label: "Asistencias",
          value: summary.attended ?? 0,
          color: "FF0AA57D",
          icon: "✓",
        },
        {
          label: "Faltas",
          value: summary.absent ?? 0,
          color: "FFDF1748",
          icon: "×",
        },
        {
          label: "Bonos",
          value: summary.bonus ?? 0,
          color: "FFE78905",
          icon: "🏆",
        },
      ];

      const cardWidth = Math.max(2, Math.ceil(totalExcelColumns / 5));
      const cardStartRow = 4;
      const cardEndRow = 6;

      summaryCards.forEach((card, index) => {
        const startCol = 1 + index * cardWidth;
        const endCol =
          index === summaryCards.length - 1
            ? totalExcelColumns
            : Math.min(totalExcelColumns, startCol + cardWidth - 1);

        worksheet.mergeCells(cardStartRow, startCol, cardEndRow, endCol);
        const cell = worksheet.getCell(cardStartRow, startCol);
        cell.value = `${card.icon}  ${card.label}\n${card.value}`;
        cell.font = {
          name: FONT,
          size: 12,
          bold: true,
          color: { argb: COLORS.white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: card.color },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: { style: "medium", color: { argb: card.color } },
          left: { style: "medium", color: { argb: card.color } },
          bottom: { style: "medium", color: { argb: card.color } },
          right: { style: "medium", color: { argb: card.color } },
        };
      });

      worksheet.getRow(4).height = 24;
      worksheet.getRow(5).height = 24;
      worksheet.getRow(6).height = 24;

      // Separación visual antes de la tabla.
      worksheet.mergeCells(7, 1, 7, totalExcelColumns);
      worksheet.getCell(7, 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.white },
      };
      worksheet.getRow(7).height = 8;

      // ==========================================================
      // ENCABEZADO DE TABLA — DIRECTORIO / CATEGORÍAS / RESUMEN
      // ==========================================================
      const headerTopRow = 8;
      const headerBottomRow = 9;

      baseHeaders.forEach((header, index) => {
        worksheet.mergeCells(
          headerTopRow,
          index + 1,
          headerBottomRow,
          index + 1
        );
        const cell = worksheet.getCell(headerTopRow, index + 1);
        cell.value = header;
      });

      sessionColumns.forEach(({ category, session }, index) => {
        const col = baseHeaders.length + index + 1;
        const categoryCell = worksheet.getCell(headerTopRow, col);
        categoryCell.value = CATEGORY_LABELS[category] || category;

        const sessionCell = worksheet.getCell(headerBottomRow, col);
        sessionCell.value = `${formatSessionHeader(session)}${
          session.time ? `\n${session.time}` : ""
        }`;
      });

      const summaryStart = baseHeaders.length + sessionColumns.length + 1;
      worksheet.mergeCells(
        headerTopRow,
        summaryStart,
        headerTopRow,
        summaryStart + summaryHeaders.length - 1
      );
      worksheet.getCell(headerTopRow, summaryStart).value = "RESUMEN";

      summaryHeaders.forEach((header, index) => {
        worksheet.getCell(headerBottomRow, summaryStart + index).value = header;
      });

      // Estilo base de los encabezados.
      for (let col = 1; col <= totalExcelColumns; col += 1) {
        for (let row = headerTopRow; row <= headerBottomRow; row += 1) {
          const cell = worksheet.getCell(row, col);
          cell.font = {
            name: FONT,
            size: 9,
            bold: true,
            color: { argb: COLORS.white },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.night },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.border = whiteBorder;
        }
      }

      // Las sesiones tienen el mismo color de categoría que la web.
      sessionColumns.forEach(({ category }, index) => {
        const col = baseHeaders.length + index + 1;
        const categoryColor = categoryColors[category] || COLORS.night;

        worksheet.getCell(headerTopRow, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: categoryColor },
        };

        worksheet.getCell(headerBottomRow, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.tableHead },
        };
        worksheet.getCell(headerBottomRow, col).font = {
          name: FONT,
          size: 8,
          bold: true,
          color: { argb: COLORS.text },
        };
      });

      // Directorio y resumen conservan el azul nocturno de la web.
      for (let col = 1; col <= baseHeaders.length; col += 1) {
        worksheet.getCell(headerTopRow, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.night },
        };
      }

      for (let col = summaryStart; col < summaryStart + 4; col += 1) {
        worksheet.getCell(headerTopRow, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.night },
        };
        worksheet.getCell(headerBottomRow, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.night },
        };
      }

      worksheet.getRow(headerTopRow).height = 24;
      worksheet.getRow(headerBottomRow).height = 36;

      // ==========================================================
      // DATOS
      // ==========================================================
      filteredMembers.forEach((member, rowIndex) => {
        const row = 10 + rowIndex;
        const totals = getMemberTotals(member);
        const directory = member?.user || {};

        const values = [
          member?.doc || directory?.doc || "",
          member?.name || directory?.name || "",
          directory?.username || "",
          member?.circle || directory?.circle || "",
          directory?.rank || directory?.job || "",
          directory?.email || "",
          directory?.phone || "",
        ];

        values.forEach((value, index) => {
          const cell = worksheet.getCell(row, index + 1);
          cell.value = value;
          cell.font = {
            name: FONT,
            size: 9,
            color: { argb: COLORS.textSecondary },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.white },
          };
          cell.border = thinBorder;
          cell.alignment = {
            vertical: "middle",
            horizontal: index === 1 ? "left" : "left",
            wrapText: false,
          };
        });

        sessionColumns.forEach(({ session }, index) => {
          const item = getMemberSession(member, session);
          const col = baseHeaders.length + index + 1;
          const cell = worksheet.getCell(row, col);

          cell.value = item ? statusLabel(item) : "·";
          cell.font = {
            name: FONT,
            size: 10,
            bold: true,
            color: { argb: COLORS.muted },
          };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
          cell.border = thinBorder;

          if (item) {
            const cls = statusClass(item);
            const [fill, font] =
              statusStyles[cls] || statusStyles.pending;

            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: fill },
            };
            cell.font = {
              name: FONT,
              size: 10,
              bold: true,
              color: { argb: font },
            };
          } else {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: COLORS.empty },
            };
          }
        });

        const summaryValues = [
          totals.attended,
          totals.absent,
          `${totals.percentage}%`,
          totals.bonus ? "🏆 GANÓ" : "—",
        ];

        summaryValues.forEach((value, index) => {
          const cell = worksheet.getCell(row, summaryStart + index);
          cell.value = value;
          cell.font = {
            name: FONT,
            size: 9,
            bold: true,
            color: { argb: COLORS.text },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: COLORS.white },
          };
          cell.border = thinBorder;
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };
        });

        worksheet.getCell(row, summaryStart).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: COLORS.successDark },
        };
        worksheet.getCell(row, summaryStart + 1).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: COLORS.dangerDark },
        };
        worksheet.getCell(row, summaryStart + 2).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: "FF183875" },
        };
        worksheet.getCell(row, summaryStart + 3).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: {
            argb: totals.bonus ? COLORS.warningDark : "FF94A3B8",
          },
        };

        // Zebra muy suave para conservar la limpieza visual de la página.
        if (rowIndex % 2 === 1) {
          for (let col = 1; col <= baseHeaders.length; col += 1) {
            worksheet.getCell(row, col).fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFBFDFF" },
            };
          }
        }
      });

      // ==========================================================
      // ANCHOS / ALTURAS / FILTRO / IMPRESIÓN
      // ==========================================================
      const widths = [
        12, // DNI
        34, // NOMBRE
        18, // USUARIO
        20, // CÍRCULO
        20, // RANGO / CARGO
        30, // CORREO
        17, // TELÉFONO
      ];

      widths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
      });

      sessionColumns.forEach((_, index) => {
        worksheet.getColumn(baseHeaders.length + index + 1).width = 12;
      });

      worksheet.getColumn(summaryStart).width = 10;
      worksheet.getColumn(summaryStart + 1).width = 10;
      worksheet.getColumn(summaryStart + 2).width = 10;
      worksheet.getColumn(summaryStart + 3).width = 14;

      for (let row = 10; row <= Math.max(10, 9 + filteredMembers.length); row += 1) {
        worksheet.getRow(row).height = 27;
      }

      worksheet.autoFilter = {
        from: { row: headerBottomRow, column: 1 },
        to: {
          row: Math.max(headerBottomRow, headerBottomRow + filteredMembers.length),
          column: totalExcelColumns,
        },
      };

      worksheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
        horizontalDpi: 300,
        verticalDpi: 300,
      };
      worksheet.pageSetup.margins = {
        left: 0.25,
        right: 0.25,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      };
      worksheet.headerFooter.oddFooter =
        "&LReporte Mensual&C%Círculos Connect&RPágina &P de &N";
      worksheet.printOptions = {
        horizontalCentered: true,
        verticalCentered: false,
        gridLines: false,
      };
      worksheet.views = [
        {
          state: "frozen",
          xSplit: 1,
          ySplit: headerBottomRow,
          showGridLines: false,
        },
      ];

      // ==========================================================
      // HOJA DE GANADORES — MISMO ESTILO VISUAL
      // ==========================================================
      const winners = filteredMembers.filter(
        (member) => getMemberTotals(member).bonus
      );

      const winnerSheet = workbook.addWorksheet("Ganadores del Bono", {
        views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
      });

      const winnerHeaders = [
        "DNI",
        "NOMBRE",
        "USUARIO",
        "CÍRCULO",
        "RANGO / CARGO",
        "CORREO",
        "TELÉFONO",
        "ASISTENCIAS",
        "FALTAS",
        "% ASISTENCIA",
        "BONO",
      ];

      winnerSheet.mergeCells(1, 1, 1, winnerHeaders.length);
      const winnerTitle = winnerSheet.getCell(1, 1);
      winnerTitle.value = `Ganadores del Bono — ${reportTitle}`;
      winnerTitle.font = {
        name: FONT,
        size: 16,
        bold: true,
        color: { argb: COLORS.white },
      };
      winnerTitle.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.night },
      };
      winnerTitle.alignment = {
        horizontal: "center",
        vertical: "middle",
      };
      winnerSheet.getRow(1).height = 32;

      winnerSheet.mergeCells(2, 1, 2, winnerHeaders.length);
      const winnerSubtitle = winnerSheet.getCell(2, 1);
      winnerSubtitle.value = `Círculo: ${circle || "Todos los círculos"}`;
      winnerSubtitle.font = {
        name: FONT,
        size: 10,
        italic: true,
        color: { argb: COLORS.muted },
      };
      winnerSubtitle.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: COLORS.surface },
      };
      winnerSubtitle.alignment = {
        horizontal: "left",
        vertical: "middle",
      };
      winnerSheet.getRow(2).height = 24;

      winnerHeaders.forEach((header, index) => {
        const cell = winnerSheet.getCell(3, index + 1);
        cell.value = header;
        cell.font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: COLORS.white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.night },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = whiteBorder;
      });
      winnerSheet.getRow(3).height = 28;

      winners.forEach((member, index) => {
        const row = 4 + index;
        const totals = getMemberTotals(member);
        const directory = member?.user || {};
        const values = [
          member?.doc || directory?.doc || "",
          member?.name || directory?.name || "",
          directory?.username || "",
          member?.circle || directory?.circle || "",
          directory?.rank || directory?.job || "",
          directory?.email || "",
          directory?.phone || "",
          totals.attended,
          totals.absent,
          `${totals.percentage}%`,
          "🏆 GANÓ",
        ];

        values.forEach((value, colIndex) => {
          const cell = winnerSheet.getCell(row, colIndex + 1);
          cell.value = value;
          cell.font = {
            name: FONT,
            size: 9,
            color: { argb: COLORS.textSecondary },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: index % 2 === 0 ? COLORS.white : "FFFBFDFF",
            },
          };
          cell.border = thinBorder;
          cell.alignment = {
            horizontal: colIndex >= 7 ? "center" : "left",
            vertical: "middle",
          };
        });

        winnerSheet.getCell(row, 8).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: COLORS.successDark },
        };
        winnerSheet.getCell(row, 9).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: COLORS.dangerDark },
        };
        winnerSheet.getCell(row, 10).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: "FF183875" },
        };
        winnerSheet.getCell(row, 11).font = {
          name: FONT,
          size: 9,
          bold: true,
          color: { argb: COLORS.warningDark },
        };
      });

      [12, 34, 18, 20, 20, 30, 17, 13, 10, 15, 14].forEach(
        (width, index) => {
          winnerSheet.getColumn(index + 1).width = width;
        }
      );

      if (winners.length) {
        winnerSheet.autoFilter = {
          from: { row: 3, column: 1 },
          to: { row: 3 + winners.length, column: winnerHeaders.length },
        };
      }

      winnerSheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
      };
      winnerSheet.pageSetup.margins = {
        left: 0.25,
        right: 0.25,
        top: 0.45,
        bottom: 0.45,
        header: 0.2,
        footer: 0.2,
      };
      winnerSheet.headerFooter.oddFooter =
        "&LGanadores del Bono&C%Círculos Connect&RPágina &P de &N";
      winnerSheet.printOptions = {
        horizontalCentered: true,
        verticalCentered: false,
        gridLines: false,
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        `Reporte_Mensual_${String(reportTitle)
          .replaceAll(" ", "_")
          .replaceAll("/", "-")}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exportando Excel:", err);
      setError(
        err?.message ||
          "No se pudo generar el Excel del reporte."
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = "📊 Descargar Excel";
      }
    }
  };

  /*
   * Solo contamos las columnas
   * de las categorías que realmente
   * existen este mes.
   */
  const totalColumns =
    visibleCategories.reduce(
      (
        total,
        category
      ) =>
        total +
        getCategorySessions(
          category
        ).length,
      1
    ) + 4;

  return (
    <section className="monthly-report-page">

      {/* =========================
          BARRA SUPERIOR
          ========================= */}
      <div className="monthly-report-toolbar">

        <div className="monthly-report-top">

          <div className="monthly-report-month">

            <button
              type="button"
              onClick={() =>
                moveMonth(-1)
              }
              className="navigation-arrow"
              aria-label="Mes anterior"
            >
              ‹
            </button>

            <div className="monthly-report-title">
              <h2>
                Reporte de{" "}
                {reportTitle}
              </h2>
            </div>

            <button
              type="button"
              onClick={() =>
                moveMonth(1)
              }
              className="navigation-arrow"
              aria-label="Mes siguiente"
            >
              ›
            </button>

            <button
              type="button"
              className="monthly-report-today"
              onClick={() => {
                setYear(
                  today.getFullYear()
                );

                setMonth(
                  today.getMonth() +
                    1
                );
              }}
            >
              Hoy
            </button>

          </div>

          <div className="monthly-report-downloads">

            <button
              id="monthly-report-download-excel"
              type="button"
              className="secondary-button monthly-report-download-btn"
              onClick={downloadExcel}
              disabled={loading || !filteredMembers.length}
            >
              📊 Descargar Excel
            </button>

          </div>

        </div>

      </div>

      {error && (
        <div className="dashboard-error">
          {error}
        </div>
      )}

      {/* =========================
          RESUMEN
          ========================= */}
      <div className="monthly-report-summary">

        <div className="report-summary-card blue">
          <span>👥</span>

          <div>
            <small>
              Participantes
            </small>

            <strong>
              {summary.participants ??
                summary.members ??
                members.length}
            </strong>
          </div>
        </div>

        <div className="report-summary-card dark">
          <span>🗓</span>

          <div>
            <small>
              Sesiones
            </small>

            <strong>
              {summary.sessions ??
                0}
            </strong>
          </div>
        </div>

        <div className="report-summary-card green">
          <span>✓</span>

          <div>
            <small>
              Asistencias
            </small>

            <strong>
              {summary.attended ??
                0}
            </strong>
          </div>
        </div>

        <div className="report-summary-card red">
          <span>×</span>

          <div>
            <small>
              Faltas
            </small>

            <strong>
              {summary.absent ??
                0}
            </strong>
          </div>
        </div>

        <div className="report-summary-card orange">
          <span>🏆</span>

          <div>
            <small>
              Bonos
            </small>

            <strong>
              {summary.bonus ??
                0}
            </strong>
          </div>
        </div>

      </div>

      {/* =========================
          TABLA
          ========================= */}
      <section className="monthly-report-table-card">

        <div className="monthly-report-table-head">

          <div>
            <h3>
              Registro General de
              Asistencia
            </h3>

            <p>
              <span className="legend-green">
                J
              </span>{" "}
              verde = justificación
              válida.{" "}

              <span className="legend-red">
                J
              </span>{" "}
              roja = excedente y no
              cuenta como asistencia.{" "}


            </p>
          </div>

          <div className="monthly-report-filters">
            <div className="monthly-report-filter-group">
              <span className="monthly-report-filter-label">
                Buscar miembro
              </span>

              <input
                className="monthly-report-search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="🔎 Buscar miembro..."
              />

              <select
                className="monthly-report-select"
                value={circle}
                onChange={(event) =>
                  setCircle(event.target.value)
                }
              >
                <option value="">
                  Todos los círculos
                </option>

                {circles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        <div className="monthly-report-table-wrap">

          <table className="monthly-report-table">

            <thead>

              <tr>

                <th
                  rowSpan={2}
                  className="report-fixed-column report-name-header"
                >
                  NOMBRE
                </th>

                {visibleCategories.map(
                  (category) => {
                    const categorySessions =
                      getCategorySessions(
                        category
                      );

                    return (
                      <th
                        key={category}
                        colSpan={
                          categorySessions.length
                        }
                        className={`report-category-header report-category-${category
                          .toLowerCase()
                          .replaceAll(
                            " ",
                            "-"
                          )}`}
                      >
                        {
                          CATEGORY_LABELS[
                            category
                          ]
                        }
                      </th>
                    );
                  }
                )}

                <th
                  colSpan={4}
                  className="report-summary-group-header"
                >
                  RESUMEN
                </th>

              </tr>

              <tr>

                {visibleCategories.map(
                  (category) => {
                    const categorySessions =
                      getCategorySessions(
                        category
                      );

                    return categorySessions.map(
                      (session) => (
                        <th
                          key={
                            session.meetingId
                          }
                          className="report-session-header"
                          title={`${session.title || ""}${
                            session.time
                              ? ` · ${session.time}`
                              : ""
                          }${
                            session.circle
                              ? ` · ${session.circle}`
                              : ""
                          }`}
                        >
                          <span>
                            {formatSessionHeader(
                              session
                            )}
                          </span>

                          {session.time && (
                            <small>
                              {
                                session.time
                              }
                            </small>
                          )}
                        </th>
                      )
                    );
                  }
                )}

                <th className="report-summary-header">ASIST.</th>
                <th className="report-summary-header">FALTAS</th>
                <th className="report-summary-header">%</th>
                <th className="report-summary-header">BONO</th>

              </tr>

            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td
                    colSpan={
                      Math.max(
                        2,
                        totalColumns
                      )
                    }
                    className="report-empty"
                  >
                    Cargando reporte...
                  </td>
                </tr>
              ) : !filteredMembers.length ? (
                <tr>
                  <td
                    colSpan={
                      Math.max(
                        2,
                        totalColumns
                      )
                    }
                    className="report-empty"
                  >
                    No hay miembros para
                    mostrar.
                  </td>
                </tr>
              ) : !visibleCategories.length ? (
                <tr>
                  <td
                    colSpan={2}
                    className="report-empty"
                  >
                    No existen reuniones
                    programadas en el
                    calendario para este
                    mes.
                  </td>
                </tr>
              ) : (
                filteredMembers.map(
                  (member) => {
                    const memberName =
                      member?.name ||
                      member?.user?.name ||
                      "Sin nombre";

                    const memberDoc =
                      member?.doc ||
                      member?.user?.doc ||
                      "";

                    return (
                      <tr
                        key={
                          memberDoc ||
                          member?.user
                            ?.id ||
                          memberName
                        }
                      >

                        <td className="report-member-cell">

                          <strong>
                            {memberName}
                          </strong>

                          {memberDoc && (
                            <small>
                              DNI:{" "}
                              {memberDoc}
                            </small>
                          )}

                        </td>


                        {visibleCategories.map(
                          (category) => {
                            const categorySessions =
                              getCategorySessions(
                                category
                              );

                            return categorySessions.map(
                              (session) => {
                                const item =
                                  getMemberSession(
                                    member,
                                    session
                                  );

                                if (
                                  !item
                                ) {
                                  return (
                                    <td
                                      key={
                                        session.meetingId
                                      }
                                      className="attendance-cell attendance-cell-not-applicable"
                                    >
                                      <span className="attendance-status empty">
                                         
                                      </span>
                                    </td>
                                  );
                                }

                                const cls =
                                  statusClass(
                                    item
                                  );

                                return (
                                  <td
                                    key={
                                      session.meetingId
                                    }
                                    className="attendance-cell"
                                  >
                                    <span
                                      className={`attendance-status ${cls}`}
                                      title={`${item.status || "No asistió"}${
                                        item.justificationReason
                                          ? ` · ${item.justificationReason}`
                                          : ""
                                      }`}
                                    >
                                      {
                                        statusLabel(
                                          item
                                        )
                                      }
                                    </span>
                                  </td>
                                );
                              }
                            );
                          }
                        )}

                        <td className="report-member-summary attended-total">
                          {getMemberTotals(member).attended}
                        </td>
                        <td className="report-member-summary absent-total">
                          {getMemberTotals(member).absent}
                        </td>
                        <td className="report-member-summary percentage-total">
                          {getMemberTotals(member).percentage}%
                        </td>
                        <td className="report-member-summary bonus-total">
                          {getMemberTotals(member).bonus ? "🏆" : "—"}
                        </td>

                      </tr>
                    );
                  }
                )
              )}

            </tbody>

          </table>

        </div>

      </section>

    </section>
  );
};

export default MonthlyReport;