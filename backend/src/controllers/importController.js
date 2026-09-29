    const XLSX = require("xlsx");

    const {
      importUsersFromRows,
      importPreparedUsers,
      previewUsersFromRows,
      normalizeHeader,
      HEADER_MAP,
    } = require("../services/importService");

    const { createAuditLog } = require("../services/auditService");
    const { canManageGlobal, getCircleScope } = require("../middleware/permissionMiddleware");

    const getRecognizedFieldCount = (headers) => {
      const fields = new Set();
      for (const header of headers) {
        const field = HEADER_MAP[normalizeHeader(header)];
        if (field) fields.add(field);
      }
      return fields.size;
    };

    // Busca los encabezados aunque existan títulos, filas vacías o información
    // adicional antes de la tabla. Se revisan las primeras 30 filas.
    const worksheetToRows = (worksheet) => {
      const matrix = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      if (!Array.isArray(matrix) || !matrix.length) return { rows: [], headers: [], headerRow: 0 };

      let bestIndex = -1;
      let bestScore = 0;
      let bestHeaders = [];
      const limit = Math.min(matrix.length, 30);

      for (let i = 0; i < limit; i++) {
        const candidate = (matrix[i] || []).map((value) => String(value ?? "").trim());
        const score = getRecognizedFieldCount(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
          bestHeaders = candidate;
        }
      }

      if (bestIndex < 0 || bestScore === 0) {
        // Fallback: mantiene el comportamiento normal para archivos sencillos.
        const fallback = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
        return { rows: fallback, headers: Object.keys(fallback[0] || {}), headerRow: 1 };
      }

      const rows = [];
      for (let r = bestIndex + 1; r < matrix.length; r++) {
        const values = matrix[r] || [];
        const row = {};
        let hasValue = false;

        bestHeaders.forEach((header, columnIndex) => {
          if (!header) return;
          const value = values[columnIndex] ?? "";
          row[header] = value;
          if (String(value).trim()) hasValue = true;
        });

        if (hasValue) {
          row.__excelRow = r + 1;
          rows.push(row);
        }
      }

      return {
        rows,
        headers: bestHeaders.filter(Boolean),
        headerRow: bestIndex + 1,
      };
    };

    const readUploadedWorkbook = (file) => {
      const workbook = XLSX.read(file.buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new Error("El archivo Excel no contiene hojas.");
      return worksheetToRows(workbook.Sheets[sheetName]);
    };

    const getImportContext = (admin) => ({
      allowedCircles: canManageGlobal(admin) ? null : getCircleScope(admin),
    });

    const previewUsers = async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "Debes seleccionar un archivo Excel." });
        }

        const parsed = readUploadedWorkbook(req.file);
        const result = await previewUsersFromRows(parsed.rows, parsed.headers);

        return res.json({
          fileName: req.file.originalname,
          totalRows: parsed.rows.length,
          headerRow: parsed.headerRow,
          recognizedColumns: parsed.headers.filter((header) => HEADER_MAP[normalizeHeader(header)]),
          rows: result.rows,
          validRows: result.validRows,
          errors: result.errors,
        });
      } catch (error) {
        console.error("Error previsualizando Excel:", error);
        return res.status(500).json({ message: error.message || "Error leyendo el archivo Excel." });
      }
    };

    const importUsers = async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "Debes seleccionar un archivo Excel." });
        }

        const parsed = readUploadedWorkbook(req.file);
        const admin = req.user || req.admin;

        if (!canManageGlobal(admin)) {
          const scope = getCircleScope(admin);
          if (!scope.length) {
            return res.status(403).json({ message: "Tu usuario no tiene círculos asignados para importar miembros." });
          }
        }

        const targetCircle = String(req.body?.targetCircle || "").trim();
        if (!targetCircle) {
          return res.status(400).json({ message: "Debes seleccionar el círculo destino antes de importar." });
        }

        const { allowedCircles } = getImportContext(admin);
        const result = await importUsersFromRows(parsed.rows, targetCircle, allowedCircles, parsed.headers);

        await createAuditLog({
          admin,
          action: "Importó Miembros",
          module: "Miembros",
          description: `Importación Excel: ${result.inserted} miembros agregados, ${result.updated} actualizados, ${result.skipped} omitidos.`,
          circle: canManageGlobal(admin) ? "Todos los Círculos" : getCircleScope(admin).join(", "),
          metadata: {
            fileName: req.file.originalname,
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors.length,
            allowedCircles: canManageGlobal(admin) ? ["Todos los Círculos"] : getCircleScope(admin),
          },
        });

        return res.json({ message: "Importación procesada correctamente.", ...result });
      } catch (error) {
        console.error("Error importando Excel:", error);
        return res.status(500).json({ message: error.message || "Error procesando el archivo Excel." });
      }
    };

    // Guarda las filas ya corregidas desde la ventana de revisión. No vuelve a
    // depender del archivo original, así que el usuario corrige y guarda todo de una vez.
    const commitUsers = async (req, res) => {
      try {
        const admin = req.user || req.admin;
        const targetCircle = String(req.body?.targetCircle || "").trim();
        const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

        if (!targetCircle) return res.status(400).json({ message: "Debes seleccionar el círculo destino antes de importar." });
        if (!rows.length) return res.status(400).json({ message: "No hay registros para importar." });

        if (!canManageGlobal(admin) && !getCircleScope(admin).length) {
          return res.status(403).json({ message: "Tu usuario no tiene círculos asignados para importar miembros." });
        }

        const { allowedCircles } = getImportContext(admin);
        const result = await importPreparedUsers(rows, targetCircle, allowedCircles);

        if (result.errors.length) {
          return res.status(422).json({
            message: "Todavía hay registros que necesitan corrección.",
            ...result,
          });
        }

        await createAuditLog({
          admin,
          action: "Importó Miembros",
          module: "Miembros",
          description: `Importación Excel corregida: ${result.inserted} miembros agregados, ${result.updated} actualizados, ${result.skipped} omitidos.`,
          circle: canManageGlobal(admin) ? "Todos los Círculos" : getCircleScope(admin).join(", "),
          metadata: {
            inserted: result.inserted,
            updated: result.updated,
            skipped: result.skipped,
            errors: 0,
            allowedCircles: canManageGlobal(admin) ? ["Todos los Círculos"] : getCircleScope(admin),
          },
        });

        return res.json({ message: "Importación procesada correctamente.", ...result });
      } catch (error) {
        console.error("Error guardando importación corregida:", error);
        return res.status(500).json({ message: error.message || "Error procesando los registros corregidos." });
      }
    };

    const downloadUsersTemplate = async (req, res) => {
      try {
        const workbook = XLSX.utils.book_new();

        const rows = [
          {
            Nombre: "",
            DNI: "",
            Usuario: "",
            "Círculo Asignado": "",
            Rango: "",
            "Fecha de Cambio de Rango": "",
            "Número de Teléfono": "",
            Correo: "",
          },
        ];

        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet["!cols"] = [
          { wch: 34 },
          { wch: 15 },
          { wch: 20 },
          { wch: 28 },
          { wch: 18 },
          { wch: 28 },
          { wch: 22 },
          { wch: 35 },
        ];

        XLSX.utils.book_append_sheet(workbook, worksheet, "Miembros");

        const instructions = [
          ["FORMATO PARA CARGA MASIVA DE MIEMBROS"],
          ["Usa la hoja Miembros como referencia para preparar tus datos."],
          ["Campos que el sistema utiliza:"],
          ["Nombre", "Nombre completo de la persona."],
          ["DNI", "Documento de identidad. Puede quedar vacío si no se dispone de él."],
          ["Usuario", "Usuario que se guardará en el sistema."],
          ["Círculo Asignado", "Informativo. El círculo real se selecciona en la ventana de importación y prevalece sobre este valor."],
          ["Rango", "Rango o cargo del miembro."],
          ["Fecha de Cambio de Rango", "Fecha del cambio de rango. Se recomienda usar AAAA-MM-DD."],
          ["Número de Teléfono", "Teléfono o celular."],
          ["Correo", "Correo electrónico."],
          ["IMPORTANTE", "No es obligatorio que tu archivo tenga exactamente estos nombres de columnas. El sistema intenta reconocer equivalentes comunes y solo toma los datos que puede utilizar."],
          ["Ejemplos reconocidos", "DNI/Documento, Nombre/Nombre Completo, Usuario/Username, Rango/Cargo, Correo/Email, Celular/Teléfono, Fecha de Cambio de Rango."],
          ["Correcciones", "Si se detecta un DNI repetido u otro conflicto, el sistema mostrará las filas para corregirlas antes de guardar."],
        ];

        const infoSheet = XLSX.utils.aoa_to_sheet(instructions);
        infoSheet["!cols"] = [{ wch: 28 }, { wch: 105 }];
        XLSX.utils.book_append_sheet(workbook, infoSheet, "Instrucciones");

        const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="plantilla_miembros.xlsx"');
        return res.send(buffer);
      } catch (error) {
        console.error("Error generando plantilla Excel:", error);
        return res.status(500).json({ message: "Error generando la plantilla Excel." });
      }
    };

    module.exports = {
      importUsers,
      previewUsers,
      commitUsers,
      downloadUsersTemplate,
    };
