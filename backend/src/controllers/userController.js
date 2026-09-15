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

    const query = {
      active: { $ne: false },
    };

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

const getUserById = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user || user.active === false) {
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

    const circleName = String(circle).trim();

    const circleExists =
      await Circle.findOne({
        name: circleName,
        active: true,
      });

    if (!circleExists) {
      return res.status(400).json({
        message:
          "El círculo seleccionado no existe o está inactivo.",
      });
    }

    const existing =
      await User.findOne({
        doc: normalizedDoc,
      });

    if (existing) {
      if (existing.active === false) {
        existing.name = name.trim();
        existing.username = username.trim();
        existing.circle = circleName;
        existing.job = job.trim();
        existing.email = email.trim();
        existing.phone = phone.trim();
        existing.active = true;
        existing.deletedAt = null;
        existing.deletedBy = "";

        await existing.save();

        await createAuditLog({
          admin: req.user || req.admin,
          action: "REACTIVATE_MEMBER",
          module: "members",
          description: `Se reactivó el miembro ${existing.name} en el círculo ${existing.circle}.`,
          targetId: existing._id,
          targetName: existing.name,
          circle: existing.circle,
          metadata: {
            userId: existing._id,
            doc: existing.doc,
            name: existing.name,
            username: existing.username,
            circle: existing.circle,
            job: existing.job,
            email: existing.email,
            phone: existing.phone,
            source: "manual_reactivation",
          },
        });

        return res.status(200).json({
          message:
            "Miembro reactivado correctamente.",
          user: existing,
        });
      }

      return res.status(409).json({
        message:
          "Ya existe un miembro con ese DNI.",
      });
    }

    const user =
      await User.create({
        doc: normalizedDoc,
        name: name.trim(),
        username: username.trim(),
        circle: circleName,
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


const updateUser = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user || user.active === false) {
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

const deleteUser = async (req, res) => {
  try {
    const user =
      await User.findById(
        req.params.id
      );

    if (!user || user.active === false) {
      return res.status(404).json({
        message:
          "Miembro no encontrado.",
      });
    }

    if (!hasCirclePermission(req, user.circle)) {
      return res.status(403).json({
        message:
          "No tienes permisos para eliminar este miembro.",
      });
    }

    const deletedBy = String(
      req.user?.adminId ||
      req.user?.username ||
      req.user?.name ||
      ""
    ).trim();

    user.active = false;
    user.deletedAt = new Date();
    user.deletedBy = deletedBy;

    await user.save();

    await createAuditLog({
      admin: req.user || req.admin,
      action: "DELETE_MEMBER",
      module: "members",
      description: `Se eliminó el miembro ${user.name}. Sus asistencias históricas fueron conservadas.`,
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
        softDelete: true,
        historicalAttendancePreserved: true,
      },
    });

    return res.json({
      message:
        "Miembro eliminado correctamente. Su historial fue conservado.",
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

const deleteUsersByCircle = async (req, res) => {
  try {
    if (!hasGlobalPermission(req)) {
      return res.status(403).json({
        message:
          "Solo el Administrador Principal puede eliminar miembros.",
      });
    }

    const circleName = decodeURIComponent(
      String(req.params.circleName || "").trim()
    );

    if (!circleName) {
      return res.status(400).json({
        message:
          "El círculo es obligatorio.",
      });
    }

    const circle = await Circle.findOne({
      name: {
        $regex: `^${circleName.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}$`,
        $options: "i",
      },
    });

    if (!circle) {
      return res.status(404).json({
        message:
          "Círculo no encontrado.",
      });
    }

    const members = await User.find({
      circle: circle.name,
      active: { $ne: false },
    }).select(
      "_id doc name username circle job email phone active"
    );

    if (!members.length) {
      return res.json({
        message:
          "El círculo no tiene miembros para eliminar.",
        deletedCount: 0,
        circle: circle.name,
      });
    }

    const memberSnapshots = members.map((member) => ({
      userId: String(member._id),
      doc: member.doc || "",
      name: member.name || "",
      username: member.username || "",
      circle: member.circle || "",
      job: member.job || "",
      email: member.email || "",
      phone: member.phone || "",
    }));

    const deletedBy = String(
      req.user?.adminId ||
      req.user?.username ||
      req.user?.name ||
      ""
    ).trim();

    const result = await User.updateMany(
      {
        circle: circle.name,
        active: { $ne: false },
      },
      {
        $set: {
          active: false,
          deletedAt: new Date(),
          deletedBy,
        },
      }
    );

    // La eliminación de miembros no debe fallar si la bitácora
    // presenta un problema. Los miembros ya fueron eliminados
    // correctamente y el círculo, reuniones y asistencias históricas
    // deben permanecer intactos.
    try {
      await createAuditLog({
        admin: req.user || req.admin,
        action: "DELETE_CIRCLE_MEMBERS",
        module: "members",
        description:
          `Se eliminaron ${result.modifiedCount} miembro(s) del círculo ${circle.name}. El círculo, sus reuniones y sus asistencias históricas permanecen intactos.`,
        targetId: circle._id,
        targetName: circle.name,
        circle: circle.name,
        metadata: {
          circleId: String(circle._id),
          circleName: circle.name,
          deletedCount: result.modifiedCount,
          members: memberSnapshots,
          circlePreserved: true,
          meetingsPreserved: true,
          attendanceHistoryPreserved: true,
        },
      });
    } catch (auditError) {
      console.error(
        "Error guardando bitácora de eliminación masiva:",
        auditError
      );
    }

    return res.json({
      message:
        `${result.modifiedCount} miembro(s) eliminado(s) correctamente del círculo.`,
      deletedCount: result.modifiedCount,
      circle: circle.name,
    });
  } catch (error) {
    console.error(
      "Error eliminando todos los miembros del círculo:",
      error
    );

    return res.status(500).json({
      message:
        error?.message ||
        "Error eliminando los miembros del círculo.",
    });
  }
};

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  deleteUsersByCircle,
};