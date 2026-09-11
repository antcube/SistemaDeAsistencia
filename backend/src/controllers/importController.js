const XLSX =
  require("xlsx");

const {
  importUsersFromRows,
  previewUsersFromRows,
} = require("../services/importService");

const {
  createAuditLog,
} = require("../services/auditService");

const {
  canManageGlobal,
  getCircleScope,
} = require("../middleware/permissionMiddleware");

const previewUsers = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Debes seleccionar un archivo Excel." });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({ message: "El archivo Excel no contiene hojas." });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
    const result = await previewUsersFromRows(rows);

    return res.json({
      fileName: req.file.originalname,
      totalRows: rows.length,
      validRows: result.validRows,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error previsualizando Excel:", error);
    return res.status(500).json({ message: "Error leyendo el archivo Excel." });
  }
};

const importUsers = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message:
          "Debes seleccionar un archivo Excel.",
      });
    }

    const workbook =
      XLSX.read(
        req.file.buffer,
        {
          type: "buffer",
        }
      );

    const sheetName =
      workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        message:
          "El archivo Excel no contiene hojas.",
      });
    }

    const worksheet =
      workbook.Sheets[
        sheetName
      ];

    const rows =
      XLSX.utils.sheet_to_json(
        worksheet,
        {
          defval: "",
          raw: false,
        }
      );

    const admin =
      req.user || req.admin;

    if (!canManageGlobal(admin)) {
      const scope = getCircleScope(admin);

      if (!scope.length) {
        return res.status(403).json({
          message:
            "Tu usuario no tiene círculos asignados para importar miembros.",
        });
      }
    }

    const targetCircle = String(req.body?.targetCircle || "").trim();

    if (!targetCircle) {
      return res.status(400).json({
        message: "Debes seleccionar el círculo destino antes de importar.",
      });
    }

    const allowedCircles = canManageGlobal(admin)
      ? null
      : getCircleScope(admin);

    const result = await importUsersFromRows(
      rows,
      targetCircle,
      allowedCircles
    );

    await createAuditLog({
      admin,

      action:
        "Importó Miembros",

      module:
        "Miembros",

      description:
        `Importación Excel: ${result.inserted} miembros agregados, ${result.skipped} omitidos.`,

      circle:
        canManageGlobal(admin)
          ? "Todos los Círculos"
          : getCircleScope(admin).join(", "),

      metadata: {
        fileName:
          req.file.originalname,

        inserted:
          result.inserted,

        skipped:
          result.skipped,

        errors:
          result.errors.length,

        allowedCircles:
          canManageGlobal(admin)
            ? ["Todos los Círculos"]
            : getCircleScope(admin),
      },
    });

    return res.json({
      message:
        "Importación procesada correctamente.",

      ...result,
    });
  } catch (error) {
    console.error(
      "Error importando Excel:",
      error
    );

    return res.status(500).json({
      message:
        "Error procesando el archivo Excel.",
    });
  }
};

const downloadUsersTemplate =
  async (req, res) => {
    try {
      const workbook =
        XLSX.utils.book_new();

      const rows = [
        {
          DNI: "",
          Nombre: "",
          Usuario: "",
          "Círculo": "",
          Rango: "",
          Correo: "",
          Teléfono: "",
        },
      ];

      const worksheet =
        XLSX.utils.json_to_sheet(
          rows
        );

      worksheet["!cols"] = [
        { wch: 15 },
        { wch: 30 },
        { wch: 20 },
        { wch: 25 },
        { wch: 20 },
        { wch: 35 },
        { wch: 18 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        "Miembros"
      );

      const buffer =
        XLSX.write(workbook, {
          type: "buffer",
          bookType: "xlsx",
        });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        'attachment; filename="plantilla_miembros.xlsx"'
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        "Error generando plantilla Excel:",
        error
      );

      return res.status(500).json({
        message:
          "Error generando la plantilla Excel.",
      });
    }
  };

module.exports = {
  importUsers,
  previewUsers,
  downloadUsersTemplate,
};