const AuditLog =
  require("../models/AuditLog");

const {
  canManageGlobal,
} = require("../middleware/permissionMiddleware");

const getAuditLogs = async (
  req,
  res
) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = "",
      module = "",
      action = "",
      circle = "",
    } = req.query;

    const admin =
      req.user || req.admin;

    if (!admin) {
      return res.status(401).json({
        message:
          "Usuario no autenticado.",
      });
    }

    if (
      !canManageGlobal(admin)
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

    const query = {};

    if (module.trim()) {
      query.module =
        module.trim();
    }

    if (action.trim()) {
      query.action =
        action.trim();
    }

    if (circle.trim()) {
      query.circle =
        circle.trim();
    }

    if (search.trim()) {
      const value =
        search.trim();

      query.$or = [
        {
          adminId: {
            $regex: value,
            $options: "i",
          },
        },
        {
          adminName: {
            $regex: value,
            $options: "i",
          },
        },
        {
          action: {
            $regex: value,
            $options: "i",
          },
        },
        {
          description: {
            $regex: value,
            $options: "i",
          },
        },
        {
          targetName: {
            $regex: value,
            $options: "i",
          },
        },
      ];
    }

    const skip =
      (currentPage - 1) *
      currentLimit;

    const [
      logs,
      total,
    ] = await Promise.all([
      AuditLog.find(query)
        .sort({
          createdAt: -1,
        })
        .skip(skip)
        .limit(currentLimit),

      AuditLog.countDocuments(
        query
      ),
    ]);

    return res.json({
      data: logs,
      pagination: {
        page: currentPage,
        limit: currentLimit,
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