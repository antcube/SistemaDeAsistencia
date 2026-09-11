const User = require("../models/User");
const Circle = require("../models/Circle");

const {
  canManageGlobal,
  canManageCircle,
} = require("../middleware/permissionMiddleware");

const {
  createAuditLog,
} = require("../services/auditService");

const hasGlobalPermission = (req) => {
  return canManageGlobal(req.user);
};

const hasCirclePermission = (req, circle) => {
  if (hasGlobalPermission(req)) {
    return true;
  }

  return canManageCircle(req.user, circle);
};

/**
 * ============================================================
 * LISTAR MIEMBROS
 * ============================================================
 */
const getUsers = async (req, res) => {
  try {
    const {
      search = "",
      circle = "",
      page = 1,
      limit = 50,
    } = req.query;

    const numericPage = Math.max(
      Number(page) || 1,
      1
    );

    const numericLimit = Math.min(
      Math.max(Number(limit) || 50, 1),
      200
    );

    const query = {};

    /*
     * Los gestores solamente pueden consultar
     * miembros de sus círculos.
     */
    if (!hasGlobalPermission(req)) {
      const scopes =
        req.user.circleScope || [];

      query.circle = {
        $in: scopes,
      };
    }

    if (circle) {
      if (!hasCirclePermission(req, circle)) {
        return res.status(403).json({
          message:
            "No tienes permisos para consultar este círculo.",
        });
      }

      query.circle = circle;
    }

    if (search.trim()) {
      const value = search.trim();

      query.$or = [
        {
          doc: {
            $regex: value,
            $options: "i",
          },
        },
        {
          name: {
            $regex: value,
            $options: "i",
          },
        },
        {
          username: {
            $regex: value,
            $options: "i",
          },
        },
        {
          job: {
            $regex: value,
            $options: "i",
          },
        },
        {
          email: {
            $regex: value,
            $options: "i",
          },
        },
      ];
    }

    const total =
      await User.countDocuments(query);

    const users =
      await User.find(query)
        .sort({
          name: 1,
        })
        .skip(
          (numericPage - 1) *
            numericLimit
        )
        .limit(numericLimit);

    return res.json({
      users,
      pagination: {
        page: numericPage,
        limit: numericLimit,
        total,
        totalPages:
          Math.ceil(
            total / numericLimit
          ) || 1,
      },
    });
  } catch (error) {
    console.error(
      "Error obteniendo miembros:",
      error
    );

    return res.status(500).json({
      message:
        "Error obteniendo miembros.",
    });
  }
};

/**
 * ============================================================
 * OBTENER MIEMBRO POR ID
 * ============================================================
 */
const getUserById = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Miembro no encontrado.",
      });
    }

    if (
      !hasCirclePermission(
        req,
        user.circle
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos para consultar este miembro.",
      });
    }

    return res.json(user);
  } catch (error) {
    console.error(
      "Error obteniendo miembro:",
      error
    );

    return res.status(500).json({
      message:
        "Error obteniendo miembro.",
    });
  }
};

/**
 * ============================================================
 * CREAR MIEMBRO
 * ============================================================
 */
const createUser = async (req, res) => {
  try {
    const {
      doc,
      name,
      username = "",
      circle,
      job = "",
      email = "",
      phone = "",
    } = req.body;

    if (!doc || !name || !circle) {
      return res.status(400).json({
        message:
          "DNI, nombre y círculo son obligatorios.",
      });
    }

    if (
      !hasCirclePermission(
        req,
        circle
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos para este círculo.",
      });
    }

    const normalizedDoc =
      String(doc).trim();

    const existing =
      await User.findOne({
        doc: normalizedDoc,
      });

    if (existing) {
      return res.status(409).json({
        message:
          "Ya existe un miembro con ese DNI.",
      });
    }

    const circleExists =
      await Circle.findOne({
        name: circle,
        active: true,
      });

    if (!circleExists) {
      return res.status(400).json({
        message:
          "El círculo seleccionado no existe o está inactivo.",
      });
    }

    const user =
      await User.create({
        doc: normalizedDoc,
        name: name.trim(),
        username: username.trim(),
        circle: circle.trim(),
        job: job.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });

    await createAuditLog({
      admin: req.user || req.admin,
      action: "CREATE_MEMBER",
      module: "members",
      description: `Se registró el miembro ${user.name} en el círculo ${user.circle}.`,
      targetId: user._id,
      targetName: user.name,
      circle: user.circle,
      metadata: {
        userId: user._id,
        doc: user.doc,
        name: user.name,
        username: user.username,
        circle: user.circle,
        job: user.job,
        email: user.email,
        phone: user.phone,
        source: "manual",
      },
    });

    return res.status(201).json({
      message:
        "Miembro creado correctamente.",
      user,
    });
  } catch (error) {
    console.error(
      "Error creando miembro:",
      error
    );

    /*
     * Protección adicional contra carreras
     * con el índice unique de MongoDB.
     */
    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        message:
          "Ya existe un miembro con ese DNI.",
      });
    }

    return res.status(500).json({
      message:
        "Error creando miembro.",
    });
  }
};

/**
 * ============================================================
 * ACTUALIZAR MIEMBRO
 * ============================================================
 */
const updateUser = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Miembro no encontrado.",
      });
    }

    /*
     * Para cambiar un miembro de círculo,
     * necesitamos permiso tanto sobre el círculo
     * actual como sobre el nuevo.
     */
    if (
      !hasCirclePermission(
        req,
        user.circle
      )
    ) {
      return res.status(403).json({
        message:
          "No tienes permisos para modificar este miembro.",
      });
    }

    const previousUser = {
      doc: user.doc,
      name: user.name,
      username: user.username,
      circle: user.circle,
      job: user.job,
      email: user.email,
      phone: user.phone,
    };

    const {
      doc,
      name,
      username,
      circle,
      job,
      email,
      phone,
    } = req.body;

    if (doc !== undefined) {
      const normalizedDoc =
        String(doc).trim();

      const duplicate =
        await User.findOne({
          doc: normalizedDoc,
          _id: {
            $ne: user._id,
          },
        });

      if (duplicate) {
        return res.status(409).json({
          message:
            "Ya existe otro miembro con ese DNI.",
        });
      }

      user.doc =
        normalizedDoc;
    }

    if (name !== undefined) {
      user.name =
        String(name).trim();
    }

    if (username !== undefined) {
      user.username =
        String(username).trim();
    }

    if (circle !== undefined) {
      const newCircle =
        String(circle).trim();

      if (
        !hasCirclePermission(
          req,
          newCircle
        )
      ) {
        return res.status(403).json({
          message:
            "No tienes permisos para el nuevo círculo.",
        });
      }

      const circleExists =
        await Circle.findOne({
          name: newCircle,
          active: true,
        });

      if (!circleExists) {
        return res.status(400).json({
          message:
            "El nuevo círculo no existe o está inactivo.",
        });
      }

      user.circle =
        newCircle;
    }

    if (job !== undefined) {
      user.job =
        String(job).trim();
    }

    if (email !== undefined) {
      user.email =
        String(email).trim();
    }

    if (phone !== undefined) {
      user.phone =
        String(phone).trim();
    }

    await user.save();

    const currentUser = {
      doc: user.doc,
      name: user.name,
      username: user.username,
      circle: user.circle,
      job: user.job,
      email: user.email,
      phone: user.phone,
    };

    await createAuditLog({
      admin: req.user || req.admin,
      action: "UPDATE_MEMBER",
      module: "members",
      description: `Se actualizó el miembro ${user.name}.`,
      targetId: user._id,
      targetName: user.name,
      circle: user.circle || previousUser.circle,
      metadata: {
        userId: user._id,
        previous: previousUser,
        current: currentUser,
      },
    });

    return res.json({
      message:
        "Miembro actualizado correctamente.",
      user,
    });
  } catch (error) {
    console.error(
      "Error actualizando miembro:",
      error
    );

    if (
      error.code === 11000
    ) {
      return res.status(409).json({
        message:
          "Ya existe un miembro con ese DNI.",
      });
    }

    return res.status(500).json({
      message:
        "Error actualizando miembro.",
    });
  }
};

/**
 * ============================================================
 * ELIMINAR MIEMBRO
 * ============================================================
 *
 * Eliminar un miembro NO elimina:
 * - reuniones
 * - asistencias históricas
 * - registros de asistencia
 *
 * Solamente elimina el registro del miembro.
 */
const deleteUser = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user) {
      return res.status(404).json({
        message:
          "Miembro no encontrado.",
      });
    }

    if (!hasGlobalPermission(req)) {
      return res.status(403).json({
        message:
          "Solo el Administrador Principal puede eliminar miembros.",
      });
    }

    await User.findByIdAndDelete(
      user._id
    );

    await createAuditLog({
      admin: req.user || req.admin,
      action: "DELETE_MEMBER",
      module: "members",
      description: `Se eliminó el miembro ${user.name}.`,
      targetId: user._id,
      targetName: user.name,
      circle: user.circle,
      metadata: {
        userId: user._id,
        doc: user.doc,
        name: user.name,
        username: user.username,
        circle: user.circle,
        job: user.job,
        email: user.email,
        phone: user.phone,
      },
    });

    return res.json({
      message:
        "Miembro eliminado correctamente.",
    });
  } catch (error) {
    console.error(
      "Error eliminando miembro:",
      error
    );

    return res.status(500).json({
      message:
        "Error eliminando miembro.",
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};