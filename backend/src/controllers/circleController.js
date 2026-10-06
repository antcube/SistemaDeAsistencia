const Circle = require("../models/Circle");
const { createAuditLog } = require("../services/auditService");

const {
  isGlobalAdministrator,
  getCircleScope,
  hasCircleAccess,
} = require("../middleware/permissionMiddleware");

const {
  ensureDefaultSchedules,
} = require("../services/scheduleService");

const circleSnapshot = (circle) => ({
  name: circle.name || "",
  active: Boolean(circle.active),
});

/**
 * ============================================================
 * OBTENER CÍRCULOS
 * ============================================================
 */
const getCircles = async (
  req,
  res
) => {
  try {
    const query = {
      active: true,
    };

    if (
      !isGlobalAdministrator(
        req.user
      )
    ) {
      const scope =
        getCircleScope(
          req.user
        );

      if (!scope.length) {
        return res.json([]);
      }

      query.name = {
        $in: scope,
      };
    }

    const circles =
      await Circle.find(
        query
      ).sort({
        name: 1,
      });

    res.json(circles);
  } catch (error) {
    console.error(
      "Error obteniendo círculos:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener los círculos",
    });
  }
};

/**
 * ============================================================
 * OBTENER CÍRCULO POR ID
 * ============================================================
 */
const getCircleById = async (
  req,
  res
) => {
  try {
    const circle =
      await Circle.findById(
        req.params.id
      );

    if (!circle) {
      return res.status(404).json({
        message:
          "Círculo no encontrado",
      });
    }

    if (
      !isGlobalAdministrator(
        req.user
      ) &&
      !hasCircleAccess(
        req.user,
        circle.name
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos para consultar este círculo.",
      });
    }

    res.json(circle);
  } catch (error) {
    console.error(
      "Error obteniendo círculo:",
      error
    );

    res.status(500).json({
      message:
        "Error al obtener el círculo",
    });
  }
};

/**
 * ============================================================
 * CREAR CÍRCULO
 * ============================================================
 *
 * Solamente Administrador General.
 *
 * Al crear el círculo:
 *
 * 1. Se crea el Circle.
 * 2. Se crea automáticamente HEALTH.
 * 3. Se crea automáticamente MENTORÍA.
 *
 * No se crea ningún administrador.
 */
const createCircle = async (
  req,
  res
) => {
  try {
    if (
      !isGlobalAdministrator(
        req.user
      )
    ) {
      return res.status(403).json({
        message:
          "Solo el Administrador General puede crear círculos.",
      });
    }

    const {
      name,
      createdBy,
    } = req.body;

    if (
      !name ||
      !String(name).trim()
    ) {
      return res.status(400).json({
        message:
          "El nombre del círculo es obligatorio",
      });
    }

    const normalizedName =
      String(name).trim();

    const existingCircle =
      await Circle.findOne({
        name: {
          $regex: `^${normalizedName}$`,
          $options: "i",
        },
      });

    /*
     * Si ya existe un círculo con ese nombre pero está
     * inactivo, lo reactivamos en lugar de crear un segundo
     * documento con el mismo nombre.
     *
     * Esto permite eliminar/desactivar un círculo y después
     * volver a crear uno con el mismo nombre sin romper el
     * índice unique de MongoDB ni duplicar referencias.
     */
    if (existingCircle) {
      if (!existingCircle.active) {
        existingCircle.active = true;

        const before = circleSnapshot(existingCircle);
        const circle =
          await existingCircle.save();

        try {
          await ensureDefaultSchedules([
            normalizedName,
          ]);
        } catch (scheduleError) {
          console.error(
            "Error asegurando programaciones predeterminadas al reactivar el círculo:",
            scheduleError
          );
        }

        await createAuditLog({
          admin: req.user, action: "RESTORE_CIRCLE", module: "circles",
          description: `Se reactivó el círculo ${circle.name}.`, targetId: circle._id, targetName: circle.name, circle: circle.name, reversible: true,
          metadata: { before, after: circleSnapshot(circle) },
        });

        return res.status(200).json({
          ...circle.toObject(),
          reactivated: true,
          message:
            `Círculo "${normalizedName}" reactivado correctamente.`,
        });
      }

      return res.status(409).json({
        message:
          "Ya existe un círculo con ese nombre",
      });
    }

    /*
     * Primero creamos el círculo.
     */
    const circle =
      await Circle.create({
        name:
          normalizedName,

        createdBy:
          createdBy || "",
      });

    /*
     * Inmediatamente aseguramos las dos
     * programaciones oficiales para este círculo.
     *
     * Esto hace que el círculo nuevo no tenga
     * que esperar a que alguien abra el reporte.
     */
    try {
      await ensureDefaultSchedules([
        normalizedName,
      ]);
    } catch (scheduleError) {
      /*
       * No eliminamos el círculo si la creación
       * de la programación falla.
       *
       * El siguiente acceso al Calendario/Reporte
       * volverá a intentar asegurar las programaciones.
       */
      console.error(
        "Error creando programaciones predeterminadas del nuevo círculo:",
        scheduleError
      );
    }

    await createAuditLog({
      admin: req.user, action: "CREATE_CIRCLE", module: "circles",
      description: `Se creó el círculo ${circle.name}.`, targetId: circle._id, targetName: circle.name, circle: circle.name, reversible: true,
      metadata: { after: circleSnapshot(circle) },
    });

    res.status(201).json(
      circle
    );
  } catch (error) {
    console.error(
      "Error creando círculo:",
      error
    );

    res.status(500).json({
      message:
        "Error al crear el círculo",
    });
  }
};

/**
 * ============================================================
 * ACTUALIZAR CÍRCULO
 * ============================================================
 */
const updateCircle = async (
  req,
  res
) => {
  try {
    if (
      !isGlobalAdministrator(
        req.user
      )
    ) {
      return res.status(403).json({
        message:
          "Solo el Administrador General puede modificar círculos.",
      });
    }

    const circle =
      await Circle.findById(
        req.params.id
      );

    if (!circle) {
      return res.status(404).json({
        message:
          "Círculo no encontrado",
      });
    }

    const before = circleSnapshot(circle);

    const {
      name,
      active,
    } = req.body;

    let newName =
      circle.name;

    if (
      name !== undefined
    ) {
      if (
        !String(name).trim()
      ) {
        return res.status(400).json({
          message:
            "El nombre del círculo no puede estar vacío",
        });
      }

      const normalizedName =
        String(name).trim();

      const duplicate =
        await Circle.findOne({
          _id: {
            $ne:
              circle._id,
          },

          name: {
            $regex: `^${normalizedName}$`,
            $options: "i",
          },
        });

      if (duplicate) {
        return res.status(409).json({
          message:
            "Ya existe otro círculo con ese nombre",
        });
      }

      circle.name =
        normalizedName;

      newName =
        normalizedName;
    }

    if (
      active !== undefined
    ) {
      circle.active =
        Boolean(active);
    }

    const updatedCircle =
      await circle.save();

    /*
     * Si el nombre cambió o el círculo fue
     * reactivado, nos aseguramos de que tenga
     * sus programaciones oficiales.
     */
    if (
      updatedCircle.active
    ) {
      try {
        await ensureDefaultSchedules([
          newName,
        ]);
      } catch (scheduleError) {
        console.error(
          "Error asegurando programaciones del círculo actualizado:",
          scheduleError
        );
      }
    }

    await createAuditLog({
      admin: req.user, action: "UPDATE_CIRCLE", module: "circles",
      description: `Se actualizó el círculo ${updatedCircle.name}.`, targetId: updatedCircle._id, targetName: updatedCircle.name, circle: updatedCircle.name, reversible: true,
      metadata: { before, after: circleSnapshot(updatedCircle) },
    });

    res.json(
      updatedCircle
    );
  } catch (error) {
    console.error(
      "Error actualizando círculo:",
      error
    );

    res.status(500).json({
      message:
        "Error al actualizar el círculo",
    });
  }
};

/**
 * ============================================================
 * ELIMINAR CÍRCULO
 * ============================================================
 *
 * No se elimina físicamente.
 */
const deleteCircle = async (
  req,
  res
) => {
  try {
    if (
      !isGlobalAdministrator(
        req.user
      )
    ) {
      return res.status(403).json({
        message:
          "Solo el Administrador General puede eliminar círculos.",
      });
    }

    const circle =
      await Circle.findById(
        req.params.id
      );

    if (!circle) {
      return res.status(404).json({
        message:
          "Círculo no encontrado",
      });
    }

    const before = circleSnapshot(circle);

    circle.active =
      false;

    await circle.save();

    await createAuditLog({
      admin: req.user, action: "DELETE_CIRCLE", module: "circles",
      description: `Se desactivó el círculo ${circle.name}.`, targetId: circle._id, targetName: circle.name, circle: circle.name, reversible: true,
      metadata: { before, after: circleSnapshot(circle) },
    });

    res.json({
      message:
        "Círculo desactivado correctamente",

      circle,
    });
  } catch (error) {
    console.error(
      "Error eliminando círculo:",
      error
    );

    res.status(500).json({
      message:
        "Error al eliminar el círculo",
    });
  }
};

module.exports = {
  getCircles,
  getCircleById,
  createCircle,
  updateCircle,
  deleteCircle,
};