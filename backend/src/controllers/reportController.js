const {
  getMonthlyCircleReport,
} = require("../services/reportService");

const {
  canManageGlobal,
  canManageCircle,
} = require("../middleware/permissionMiddleware");

const getMonthlyReport = async (req, res) => {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    const requestedCircle =
      String(req.query.circle || "").trim() || null;

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({
        message: "Año o mes inválido.",
      });
    }

    const admin = req.user || req.admin;

    if (!admin) {
      return res.status(401).json({
        message: "Usuario no autenticado.",
      });
    }

    /*
     * ADMINISTRADOR PRINCIPAL
     *
     * Puede consultar:
     * - Todos los círculos
     * - Un círculo específico
     */
    if (canManageGlobal(admin)) {
      const report = await getMonthlyCircleReport({
        year,
        month,
        circle: requestedCircle,
      });

      return res.json(report);
    }

    /*
     * GESTOR DE CÍRCULO
     *
     * Debe indicar el círculo que desea consultar.
     */
    if (!requestedCircle) {
      return res.status(400).json({
        message: "Debes indicar el círculo.",
      });
    }

    /*
     * El Gestor solamente puede consultar
     * círculos que tenga asignados.
     */
    if (!canManageCircle(admin, requestedCircle)) {
      return res.status(403).json({
        message:
          "No tienes permiso para consultar este círculo.",
      });
    }

    const report = await getMonthlyCircleReport({
      year,
      month,
      circle: requestedCircle,
    });

    return res.json(report);
  } catch (error) {
    console.error(
      "Error obteniendo reporte mensual:",
      error
    );

    return res.status(500).json({
      message:
        "Error obteniendo el reporte mensual.",
    });
  }
};

module.exports = {
  getMonthlyReport,
};