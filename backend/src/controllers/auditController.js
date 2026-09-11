const AuditLog =
  require("../models/AuditLog");

const {
  canManageGlobal,
} = require("../middleware/permissionMiddleware");


/*
 * Escapa caracteres especiales para
 * construir expresiones RegExp seguras.
 */
const escapeRegex = (
  value
) => {
  return String(
    value || ""
  ).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};


/*
 * ============================================================
 * OBTENER BITÁCORA
 * ============================================================
 */

const getAuditLogs = async (
  req,
  res
) => {

  try {

    const {
      page = 1,
      limit = 50,
      circle = "",
    } = req.query;


    const admin =
      req.user ||
      req.admin;


    if (!admin) {

      return res.status(401).json({
        message:
          "Usuario no autenticado.",
      });

    }


    if (
      !canManageGlobal(
        admin
      )
    ) {

      return res.status(403).json({
        message:
          "No tienes permiso para consultar la bitácora.",
      });

    }


    const currentPage =
      Math.max(
        Number(page) || 1,
        1
      );


    const currentLimit =
      Math.min(
        Math.max(
          Number(limit) || 50,
          1
        ),
        200
      );


    /*
     * ========================================================
     * QUERY
     * ========================================================
     */

    const query = {};


    /*
     * ========================================================
     * FILTRO POR CÍRCULO
     *
     * Ejemplo:
     *
     * LIMA 2
     *
     * coincidirá con:
     *
     * LIMA 2
     * lima 2
     * LIMA 2, LIMA 3
     * LIMA 1, LIMA 2
     *
     * pero NO:
     *
     * LIMA 1
     * LIMA 20
     * Todos los Círculos
     *
     * ========================================================
     */

    const normalizedCircle =
      String(
        circle || ""
      ).trim();


    if (
      normalizedCircle
    ) {

      const safeCircle =
        escapeRegex(
          normalizedCircle
        );


      query.circle = {
        $regex:
          `(^|,\\s*)${safeCircle}(\\s*,|$)`,
        $options: "i",
      };

    }


    /*
     * ========================================================
     * PAGINACIÓN
     * ========================================================
     */

    const skip =
      (currentPage - 1) *
      currentLimit;


    const [
      logs,
      total,
    ] = await Promise.all([

      AuditLog
        .find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(currentLimit)
        .lean(),

      AuditLog.countDocuments(
        query
      ),

    ]);


    /*
     * ========================================================
     * RESPUESTA
     * ========================================================
     */

    return res.json({

      data: logs,

      pagination: {

        page:
          currentPage,

        limit:
          currentLimit,

        total,

        totalPages:
          Math.ceil(
            total /
              currentLimit
          ) || 1,

      },

    });

  } catch (error) {

    console.error(
      "Error obteniendo bitácora:",
      error
    );

    return res.status(500).json({

      message:
        "Error obteniendo la bitácora.",

    });

  }

};


module.exports = {
  getAuditLogs,
};